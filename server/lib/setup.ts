import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "../db/index.js";
import { assignments, rules, slots, staff, weeks } from "../db/schema.js";
import { refuse } from "./assignments.js";

export const MAX_STAFF = 60;
export const MAX_PATTERN_LINES = 30;
export const MAX_SLOTS = 600;

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, 24 hour");

export const staffInput = z.object({
  id: z.string().optional().describe("Existing person's id from get-week. Omit for a new person."),
  name: z.string().trim().min(1).max(60),
  roles: z.array(z.string().trim().min(1).max(30)).min(1).max(8).describe("Roles they can work, e.g. ['cook','server']. Lower case."),
  maxShifts: z.number().int().min(0).max(14).describe("Most shifts per week."),
  hourlyRate: z.number().int().min(0).max(100000).optional().describe("Optional hourly pay in whole currency units. Used only for the cover cost; private."),
  overtimeAfterHours: z.number().int().min(1).max(100).optional().describe("Optional: weekly hours after which overtime applies."),
});
export type StaffInput = z.infer<typeof staffInput>;

export const patternInput = z.object({
  name: z.string().trim().min(1).max(40).describe("Shift name, e.g. 'Dinner server'."),
  role: z.string().trim().min(1).max(30).describe("Role needed, e.g. 'server'."),
  start: time,
  end: time.describe("A time at or before the start means the shift runs past midnight."),
  days: z.array(z.number().int().min(0).max(6)).min(1).max(7).describe("Weekdays it runs: 0 = Sunday ... 6 = Saturday."),
  count: z.number().int().min(1).max(20).describe("How many people are needed."),
});
export type PatternInput = z.infer<typeof patternInput>;

function addDays(d: string, n: number): string {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

function isRealDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const x = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === d;
}

export interface SetupResult {
  created: boolean;
  weekName: string;
  startDate: string;
  staffCount: number;
  slotCount: number;
  assignmentsCleared: number;
  rulesKept: number;
  warnings: string[];
}

/** Stable key for "has the shift pattern changed?". */
export function patternKey(weekStart: string, pattern: PatternInput[]): string {
  return JSON.stringify({
    weekStart,
    pattern: pattern.map((p) => ({ ...p, role: p.role.toLowerCase(), days: [...new Set(p.days)].sort() })),
  });
}

/**
 * Creates the owner's week from staff plus a typical-week pattern, or edits it. Editing keeps
 * people (by id) and their rules. If the shifts would change, or people with shifts are
 * removed, or the current week is the sample, the schedule placed so far is cleared, and that
 * only happens when `confirmReplace` is true.
 */
export async function saveSetup(
  owner: string,
  input: {
    weekStart: string;
    name?: string | undefined;
    staff: StaffInput[];
    pattern: PatternInput[];
    confirmReplace?: boolean | undefined;
  },
): Promise<SetupResult> {
  if (!isRealDate(input.weekStart)) refuse("The week start must be a real date.", "bad_date");
  if (input.staff.length === 0) refuse("Add at least one person.", "no_staff");
  if (input.staff.length > MAX_STAFF) refuse(`The limit is ${MAX_STAFF} people.`, "too_many");
  if (input.pattern.length === 0) refuse("Add at least one shift to the typical week.", "no_pattern");
  if (input.pattern.length > MAX_PATTERN_LINES) refuse(`The limit is ${MAX_PATTERN_LINES} shift lines.`, "too_many");
  for (const p of input.pattern) {
    if (p.start === p.end) refuse(`"${p.name}" starts and ends at the same time.`, "bad_time");
  }
  const names = input.staff.map((s) => s.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    refuse("Two people have the same name. Give each person a different name.", "duplicate_name");
  }

  const key = patternKey(input.weekStart, input.pattern);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(input.weekStart, i));
  const nonce = crypto.randomUUID().slice(0, 8);
  let n = 0;
  const newId = (p: string) => `${p}${String(++n).padStart(3, "0")}_${nonce}`;

  const newSlots: (typeof slots.$inferInsert)[] = [];
  for (const date of dates) {
    const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
    for (const p of input.pattern) {
      if (!p.days.includes(wd)) continue;
      for (let i = 0; i < p.count; i++) {
        newSlots.push({
          id: newId("sl"),
          ownerEmail: owner,
          date,
          start: p.start,
          end: p.end,
          role: p.role.toLowerCase(),
          label: p.name,
        });
      }
    }
  }
  if (newSlots.length === 0) refuse("Those days produce no shifts.", "no_slots");
  if (newSlots.length > MAX_SLOTS) refuse(`That makes ${newSlots.length} shifts; the limit is ${MAX_SLOTS}.`, "too_many");

  const roleSet = new Set(input.staff.flatMap((s) => s.roles.map((r) => r.toLowerCase())));
  const warnings = [...new Set(input.pattern.map((p) => p.role.toLowerCase()))]
    .filter((r) => !roleSet.has(r))
    .map((r) => `Nobody on your staff has the "${r}" role, so those shifts can't be filled.`);

  return getDb().transaction(async (tx) => {
    const [week] = await tx.select().from(weeks).where(eq(weeks.ownerEmail, owner)).for("update");
    const weekName = input.name?.trim() || "My restaurant";

    const staffValues = (s: StaffInput, id: string) => ({
      id,
      ownerEmail: owner,
      name: s.name,
      roles: JSON.stringify(s.roles.map((r) => r.toLowerCase())),
      maxShifts: s.maxShifts,
      hourlyRate: s.hourlyRate ?? null,
      overtimeAfterHours: s.overtimeAfterHours ?? null,
    });

    if (!week || week.isSample) {
      const placed = week
        ? (await tx.select({ id: assignments.id }).from(assignments).where(eq(assignments.ownerEmail, owner))).length
        : 0;
      if (week && !input.confirmReplace) {
        refuse(
          "Your current week is the sample restaurant. Setting up your own replaces it, including its staff, rules and schedule. Confirm to continue.",
          "needs_confirmation",
          { replaces: "sample", assignmentsCleared: placed },
        );
      }
      if (week) {
        await tx.delete(assignments).where(eq(assignments.ownerEmail, owner));
        await tx.delete(rules).where(eq(rules.ownerEmail, owner));
        await tx.delete(slots).where(eq(slots.ownerEmail, owner));
        await tx.delete(staff).where(eq(staff.ownerEmail, owner));
        await tx.delete(weeks).where(eq(weeks.ownerEmail, owner));
      }
      await tx.insert(weeks).values({
        id: crypto.randomUUID(),
        ownerEmail: owner,
        name: weekName,
        startDate: input.weekStart,
        isSample: false,
        createdAt: new Date().toISOString(),
        pattern: key,
      });
      await tx.insert(staff).values(input.staff.map((s) => staffValues(s, newId("st"))));
      await tx.insert(slots).values(newSlots);
      return {
        created: true,
        weekName,
        startDate: input.weekStart,
        staffCount: input.staff.length,
        slotCount: newSlots.length,
        assignmentsCleared: placed,
        rulesKept: 0,
        warnings,
      };
    }

    // Editing an existing, non-sample week.
    const existingStaff = await tx.select().from(staff).where(eq(staff.ownerEmail, owner));
    const existingIds = new Set(existingStaff.map((s) => s.id));
    const keepIds = new Set(input.staff.filter((s) => s.id && existingIds.has(s.id)).map((s) => s.id!));
    const removedIds = existingStaff.filter((s) => !keepIds.has(s.id)).map((s) => s.id);
    const currentAssignments = await tx.select().from(assignments).where(eq(assignments.ownerEmail, owner));
    const shiftsChanged = week.pattern !== key;
    const lost = shiftsChanged
      ? currentAssignments.length
      : currentAssignments.filter((a) => removedIds.includes(a.staffId)).length;
    if (lost > 0 && !input.confirmReplace) {
      refuse(
        shiftsChanged
          ? `Changing the shifts clears the schedule you have placed (${lost} shifts). Confirm to replace the week.`
          : `Removing people takes them off ${lost} shift(s), which become open. Confirm to continue.`,
        "needs_confirmation",
        { replaces: shiftsChanged ? "shifts" : "people", assignmentsCleared: lost },
      );
    }

    for (const s of input.staff) {
      if (s.id && existingIds.has(s.id)) {
        await tx
          .update(staff)
          .set({
            name: s.name,
            roles: JSON.stringify(s.roles.map((r) => r.toLowerCase())),
            maxShifts: s.maxShifts,
            hourlyRate: s.hourlyRate ?? null,
            overtimeAfterHours: s.overtimeAfterHours ?? null,
          })
          .where(and(eq(staff.ownerEmail, owner), eq(staff.id, s.id)));
      } else {
        await tx.insert(staff).values(staffValues(s, newId("st")));
      }
    }
    if (removedIds.length) {
      await tx.delete(assignments).where(and(eq(assignments.ownerEmail, owner), inArray(assignments.staffId, removedIds)));
      await tx.delete(rules).where(and(eq(rules.ownerEmail, owner), inArray(rules.staffId, removedIds)));
      await tx.delete(staff).where(and(eq(staff.ownerEmail, owner), inArray(staff.id, removedIds)));
    }
    if (shiftsChanged) {
      await tx.delete(assignments).where(eq(assignments.ownerEmail, owner));
      await tx.delete(slots).where(eq(slots.ownerEmail, owner));
      await tx.insert(slots).values(newSlots);
    }
    await tx
      .update(weeks)
      .set({
        name: weekName,
        startDate: input.weekStart,
        pattern: key,
        ...(shiftsChanged ? { lastChange: null } : {}),
      })
      .where(eq(weeks.ownerEmail, owner));
    const ruleRows = await tx.select({ id: rules.id }).from(rules).where(eq(rules.ownerEmail, owner));
    const slotCount = shiftsChanged
      ? newSlots.length
      : (await tx.select({ id: slots.id }).from(slots).where(eq(slots.ownerEmail, owner))).length;
    return {
      created: false,
      weekName,
      startDate: input.weekStart,
      staffCount: input.staff.length,
      slotCount,
      assignmentsCleared: lost,
      rulesKept: ruleRows.length,
      warnings,
    };
  });
}
