import { NoWriteError } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";

import {
  checkAssignment,
  repairWeek,
  solveWeek,
  type Assignment,
  type Fairness,
  type Rule,
  type SchedulingInput,
  type Slot,
  type Staff,
  type Unfilled,
} from "../../lib/solver/index";
import { getDb } from "../db/index.js";
import { assignments, rules, slots, staff, weeks } from "../db/schema.js";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbLike = Db | Tx;

export interface Schedule {
  input: SchedulingInput;
  assignments: Assignment[];
}

export interface WeekRow {
  id: string;
  name: string;
  startDate: string;
  isSample: boolean;
  pattern: string | null;
  publishedToken: string | null;
  publishedAt: string | null;
  lastChange: LastChange | null;
}

/** What the most recent move, build or cover changed. The board highlights these slots. */
export interface LastChange {
  at: string;
  kind: "move" | "build" | "cover";
  slotIds: string[];
  summary: string;
  /** A prepared (never sent) message, set after a cover. */
  message?: string;
}

function parseLastChange(raw: string | null): LastChange | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LastChange;
  } catch {
    return null;
  }
}

export async function writeLastChange(
  db: DbLike,
  owner: string,
  change: Omit<LastChange, "at">,
): Promise<void> {
  await db
    .update(weeks)
    .set({ lastChange: JSON.stringify({ at: new Date().toISOString(), ...change }) })
    .where(eq(weeks.ownerEmail, owner));
}

export function refuse(
  message: string,
  errorCode: string,
  details?: Record<string, unknown>,
): never {
  throw new NoWriteError(message, {
    errorCode,
    statusCode:
      errorCode === "rule_violation" ||
      errorCode === "shift_locked" ||
      errorCode === "needs_confirmation"
        ? 409
        : 404,
    ...(details ? { details } : {}),
  });
}

/** "Dinner server on Fri 13 Nov, 17:00 to 23:00". People never see the raw ISO date. */
export function describeSlot(slot: Slot): string {
  return `${slot.label ?? slot.role} on ${shortDay(slot.date)}, ${slot.start} to ${slot.end}`;
}

const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Fri 13 Nov" for a YYYY-MM-DD date. */
export function shortDay(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WD_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MON_SHORT[d.getUTCMonth()]}`;
}

export async function loadWeekRow(
  db: DbLike,
  owner: string,
): Promise<WeekRow | null> {
  const [w] = await db.select().from(weeks).where(eq(weeks.ownerEmail, owner));
  return w
    ? {
        id: w.id,
        name: w.name,
        startDate: w.startDate,
        isSample: w.isSample,
        pattern: w.pattern,
        publishedToken: w.publishedToken,
        publishedAt: w.publishedAt,
        lastChange: parseLastChange(w.lastChange),
      }
    : null;
}

/**
 * Everything one owner has, in the shapes the solver expects. Always filtered by owner.
 * Only CONFIRMED rules are loaded: a proposed rule never reaches the solver or any rule check.
 */
export async function loadSchedule(
  db: DbLike,
  owner: string,
): Promise<Schedule> {
  const [staffRows, slotRows, ruleRows, asgRows] = await Promise.all([
    db.select().from(staff).where(eq(staff.ownerEmail, owner)),
    db.select().from(slots).where(eq(slots.ownerEmail, owner)),
    db
      .select()
      .from(rules)
      .where(and(eq(rules.ownerEmail, owner), eq(rules.status, "confirmed"))),
    db.select().from(assignments).where(eq(assignments.ownerEmail, owner)),
  ]);
  const staffList: Staff[] = staffRows.map((r) => ({
    id: r.id,
    name: r.name,
    roles: JSON.parse(r.roles) as string[],
    maxShifts: r.maxShifts,
    ...(r.hourlyRate !== null ? { hourlyRate: r.hourlyRate } : {}),
    ...(r.overtimeAfterHours !== null
      ? { overtimeAfterHours: r.overtimeAfterHours }
      : {}),
  }));
  const slotList: Slot[] = slotRows.map((r) => ({
    id: r.id,
    date: r.date,
    start: r.start,
    end: r.end,
    role: r.role,
    ...(r.label ? { label: r.label } : {}),
  }));
  // Notes and unclear cards are not rules. Even if one were ever marked confirmed, it is skipped here.
  const ruleList: Rule[] = ruleRows
    .filter((r) => ["unavailable", "no_double", "max_shifts", "min_rest"].includes(r.kind))
    .map(
    (r) =>
      ({
        ...(JSON.parse(r.details) as object),
        id: r.id,
        staffId: r.staffId,
        severity: r.severity,
        kind: r.kind,
        ...(r.source ? { source: r.source } : {}),
      }) as Rule,
  );
  return {
    input: { staff: staffList, slots: slotList, rules: ruleList },
    assignments: asgRows.map((r) => ({
      slotId: r.slotId,
      staffId: r.staffId,
      locked: r.locked,
    })),
  };
}

export interface MoveResult {
  changed: boolean;
  slotId: string;
  slotDescription: string;
  staffId: string;
  staffName: string;
  locked: boolean;
  previousStaffId: string | null;
  previousStaffName: string | null;
  /** Set when the move took the slot from someone else. */
  displaced: { staffId: string; name: string } | null;
  /** Other shifts the repair changed because of the move. */
  repaired: {
    slotId: string;
    slotDescription: string;
    fromStaffName: string;
    toStaffName: string | null;
  }[];
  message: string;
}

/**
 * The only function that writes assignments. It loads the owner's data, re-checks the hard
 * rules with the solver, and refuses (nothing written) on any violation. Repeating the same
 * move is a no-op. Everything runs in one transaction, serialised per owner by locking the
 * owner's week row.
 */
export async function moveShift(
  owner: string,
  input: { slotId: string; staffId: string; lock?: boolean | undefined },
): Promise<MoveResult> {
  return getDb().transaction(async (tx) => {
    const [weekLock] = await tx
      .select()
      .from(weeks)
      .where(eq(weeks.ownerEmail, owner))
      .for("update");
    if (!weekLock) {
      refuse("There is no week yet. Load the sample restaurant first.", "no_week");
    }

    const data = await loadSchedule(tx, owner);
    const slot = data.input.slots.find((s) => s.id === input.slotId);
    if (!slot) refuse("That shift doesn't exist in your week.", "slot_not_found");
    const person = data.input.staff.find((s) => s.id === input.staffId);
    if (!person) {
      refuse("That person isn't on your staff list.", "staff_not_found");
    }

    const existing = data.assignments.find((a) => a.slotId === slot.id);
    const prevStaff = existing
      ? data.input.staff.find((s) => s.id === existing.staffId)
      : undefined;
    const base = {
      slotId: slot.id,
      slotDescription: describeSlot(slot),
      staffId: person.id,
      staffName: person.name,
      previousStaffId: existing?.staffId ?? null,
      previousStaffName: prevStaff?.name ?? null,
    };

    // Idempotent: same person and no lock change asked for -> nothing to do.
    if (
      existing &&
      existing.staffId === person.id &&
      (input.lock === undefined || input.lock === existing.locked)
    ) {
      return {
        ...base,
        changed: false,
        locked: existing.locked,
        displaced: null,
        repaired: [],
        message: `${person.name} already has the ${base.slotDescription} shift. Nothing changed.`,
      };
    }

    // A locked shift stays with its person until the manager unlocks it. Only a different
    // person is refused here; locking or unlocking the same person goes through.
    if (existing?.locked && existing.staffId !== person.id) {
      refuse("This shift is locked. Unlock it first.", "shift_locked", {
        slotId: slot.id,
        lockedTo: prevStaff?.name ?? null,
      });
    }

    const others = data.assignments.filter((a) => a.slotId !== slot.id);
    const check = checkAssignment(data.input, others, {
      slotId: slot.id,
      staffId: person.id,
    });
    if (!check.ok) {
      refuse(
        `Not allowed: ${check.violations.map((v) => v.message).join(" ")}`,
        "rule_violation",
        {
          violations: check.violations.map((v) => ({
            code: v.code,
            ruleId: v.ruleId ?? null,
            message: v.message,
          })),
        },
      );
    }

    const locked =
      input.lock ??
      (existing && existing.staffId === person.id ? existing.locked : false);
    if (existing) {
      await tx
        .update(assignments)
        .set({ staffId: person.id, locked })
        .where(
          and(eq(assignments.ownerEmail, owner), eq(assignments.slotId, slot.id)),
        );
    } else {
      await tx.insert(assignments).values({
        id: crypto.randomUUID(),
        ownerEmail: owner,
        slotId: slot.id,
        staffId: person.id,
        locked,
      });
    }

    const displaced =
      existing && existing.staffId !== person.id && prevStaff
        ? { staffId: prevStaff.id, name: prevStaff.name }
        : null;

    // Repair only when the move displaced someone. Only changes to other, already placed
    // shifts are applied; repair never touches locked shifts.
    const repaired: MoveResult["repaired"] = [];
    if (displaced) {
      const next: Assignment[] = [
        ...others,
        { slotId: slot.id, staffId: person.id, locked },
      ];
      const result = repairWeek(data.input, next);
      const nameOf = (id: string) =>
        data.input.staff.find((s) => s.id === id)?.name ?? id;
      for (const m of result.moved) {
        if (m.slotId === slot.id) continue;
        if (m.toStaffId === null) {
          await tx
            .delete(assignments)
            .where(
              and(
                eq(assignments.ownerEmail, owner),
                eq(assignments.slotId, m.slotId),
              ),
            );
        } else {
          await tx
            .update(assignments)
            .set({ staffId: m.toStaffId })
            .where(
              and(
                eq(assignments.ownerEmail, owner),
                eq(assignments.slotId, m.slotId),
              ),
            );
        }
        const s = data.input.slots.find((x) => x.id === m.slotId)!;
        repaired.push({
          slotId: m.slotId,
          slotDescription: describeSlot(s),
          fromStaffName: nameOf(m.fromStaffId),
          toStaffName: m.toStaffId ? nameOf(m.toStaffId) : null,
        });
      }
    }

    const message =
      `${person.name} now has the ${base.slotDescription} shift` +
      (displaced ? ` (was ${displaced.name})` : "") +
      (locked ? ", locked" : "") +
      "." +
      (repaired.length
        ? ` ${repaired.length} other shift(s) were adjusted to keep the rules.`
        : "");
    await writeLastChange(tx, owner, {
      kind: "move",
      slotIds: [slot.id, ...repaired.map((r) => r.slotId)],
      summary: message,
    });
    return { ...base, changed: true, locked, displaced, repaired, message };
  });
}

/**
 * Fairness for the assignments as they stand, from the engine: the engine is asked about
 * only the assigned slots, all treated as fixed, so nothing is searched or changed.
 */
export function currentFairness(input: SchedulingInput, assigned: Assignment[]): Fairness {
  const have = new Set(assigned.map((a) => a.slotId));
  return solveWeek({
    ...input,
    slots: input.slots.filter((s) => have.has(s.id)),
    assignments: assigned.map((a) => ({ ...a, locked: true })),
  }).fairness;
}

export interface BuildResult {
  total: number;
  filled: number;
  lockedKept: number;
  unfilled: { slotId: string; description: string; reasons: string[] }[];
  fairness: { staffId: string; name: string; shifts: number; closes: number; weekends: number; hours: number }[];
  averages: Fairness["averages"];
  changedSlotIds: string[];
  /** Locked shifts that break a hard rule (kept, but flagged). */
  lockedProblems: { slotId: string; description: string; problems: string[] }[];
  /** Rules still waiting for the manager; they were NOT used. */
  proposedRulesIgnored: number;
  message: string;
}

/**
 * Builds the week: keeps locked shifts, re-solves everything else from the confirmed rules,
 * and replaces the unlocked assignments in one transaction.
 */
export async function buildWeek(owner: string): Promise<BuildResult> {
  return getDb().transaction(async (tx) => {
    const [weekLock] = await tx.select().from(weeks).where(eq(weeks.ownerEmail, owner)).for("update");
    if (!weekLock) refuse("There is no week yet. Set up your restaurant first.", "no_week");
    const data = await loadSchedule(tx, owner);
    if (data.input.slots.length === 0) {
      refuse("There are no shifts to fill yet. Add shift needs in setup.", "no_slots");
    }
    const locked = data.assignments.filter((a) => a.locked);
    const result = solveWeek({ ...data.input, assignments: locked });

    const before = new Map(data.assignments.map((a) => [a.slotId, a.staffId]));
    const after = new Map(result.assignments.map((a) => [a.slotId, a.staffId]));
    const changedSlotIds = data.input.slots
      .map((s) => s.id)
      .filter((id) => before.get(id) !== after.get(id));

    await tx.delete(assignments).where(and(eq(assignments.ownerEmail, owner), eq(assignments.locked, false)));
    const fresh = result.assignments.filter((a) => !a.locked);
    if (fresh.length) {
      await tx.insert(assignments).values(
        fresh.map((a) => ({
          id: crypto.randomUUID(),
          ownerEmail: owner,
          slotId: a.slotId,
          staffId: a.staffId,
          locked: false,
        })),
      );
    }

    const slotById = new Map(data.input.slots.map((s) => [s.id, s]));
    const nameOf = new Map(data.input.staff.map((s) => [s.id, s.name]));
    const proposedRows = await tx
      .select({ id: rules.id, kind: rules.kind })
      .from(rules)
      .where(and(eq(rules.ownerEmail, owner), eq(rules.status, "proposed")));
    const proposedRulesIgnored = proposedRows.filter((r) => r.kind !== "note").length;

    const total = data.input.slots.length;
    const filled = result.assignments.length;
    const message =
      `Filled ${filled} of ${total} shifts.` +
      (result.unfilled.length ? ` ${result.unfilled.length} could not be filled.` : "") +
      (proposedRulesIgnored
        ? ` ${proposedRulesIgnored} proposed rule(s) are waiting for your confirmation and were not used.`
        : "");
    await writeLastChange(tx, owner, { kind: "build", slotIds: changedSlotIds, summary: message });

    return {
      total,
      filled,
      lockedKept: locked.length,
      unfilled: result.unfilled.map((u: Unfilled) => ({
        slotId: u.slotId,
        description: describeSlot(slotById.get(u.slotId)!),
        reasons: u.reasons,
      })),
      fairness: result.fairness.people.map((p) => ({
        staffId: p.staffId,
        name: nameOf.get(p.staffId) ?? p.staffId,
        shifts: p.shifts,
        closes: p.closes,
        weekends: p.weekends,
        hours: p.hours,
      })),
      averages: result.fairness.averages,
      changedSlotIds,
      lockedProblems: result.lockedViolations.map((v) => ({
        slotId: v.slotId,
        description: describeSlot(slotById.get(v.slotId)!),
        problems: v.violations.map((x) => x.message),
      })),
      proposedRulesIgnored,
      message,
    };
  });
}

const WEEKDAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Friday 13 Nov" for a YYYY-MM-DD date. */
export function longDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAY_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

export interface CoverResult {
  slotId: string;
  slotDescription: string;
  absentStaffId: string;
  absentName: string;
  coverStaffId: string | null;
  coverName: string | null;
  /** True when the shift was left open because nobody was chosen. */
  leftOpen: boolean;
  /** Other shifts the absent person has the same day. They are kept; a rebuild would move them. */
  sameDayShifts: string[];
  offRuleAdded: boolean;
  /** A message the manager can copy. Nothing is ever sent. */
  message: string | null;
  summary: string;
}

/**
 * Covers a shift for someone who can't make it. The cover person is checked against every
 * hard rule exactly like any other move; if it would break one, nothing is written. The
 * absent person gets a confirmed one-date "can't work" rule so a rebuild never puts them
 * back. With no cover person the shift is left open and the absent person is still marked off.
 */
export async function applyCover(
  owner: string,
  input: { slotId: string; coverStaffId?: string | undefined },
): Promise<CoverResult> {
  return getDb().transaction(async (tx) => {
    const [weekLock] = await tx.select().from(weeks).where(eq(weeks.ownerEmail, owner)).for("update");
    if (!weekLock) refuse("There is no week yet.", "no_week");
    const data = await loadSchedule(tx, owner);
    const slot = data.input.slots.find((s) => s.id === input.slotId);
    if (!slot) refuse("That shift doesn't exist in your week.", "slot_not_found");
    const current = data.assignments.find((a) => a.slotId === slot.id);
    if (!current) {
      refuse("Nobody is on that shift, so there is no one to cover for.", "slot_not_assigned");
    }
    const absent = data.input.staff.find((s) => s.id === current.staffId)!;
    const cover = input.coverStaffId
      ? data.input.staff.find((s) => s.id === input.coverStaffId)
      : undefined;
    if (input.coverStaffId && !cover) {
      refuse("That person isn't on your staff list.", "staff_not_found");
    }
    if (cover && cover.id === absent.id) {
      refuse(`${absent.name} is the person who can't make it. Choose someone else.`, "same_person");
    }

    const others = data.assignments.filter((a) => a.slotId !== slot.id);
    if (cover) {
      const check = checkAssignment(data.input, others, { slotId: slot.id, staffId: cover.id });
      if (!check.ok) {
        refuse(
          `Not allowed: ${check.violations.map((v) => v.message).join(" ")}`,
          "rule_violation",
          { violations: check.violations.map((v) => ({ code: v.code, message: v.message })) },
        );
      }
      await tx
        .update(assignments)
        .set({ staffId: cover.id, locked: false })
        .where(and(eq(assignments.ownerEmail, owner), eq(assignments.slotId, slot.id)));
    } else {
      await tx
        .delete(assignments)
        .where(and(eq(assignments.ownerEmail, owner), eq(assignments.slotId, slot.id)));
    }

    // Mark the absent person off for that date, once.
    const already = data.input.rules.some(
      (r) =>
        r.staffId === absent.id &&
        r.kind === "unavailable" &&
        r.severity === "hard" &&
        r.from === slot.date &&
        r.until === slot.date &&
        r.weekdays === undefined &&
        r.afterTime === undefined &&
        r.beforeTime === undefined,
    );
    if (!already) {
      await tx.insert(rules).values({
        id: `ru_${crypto.randomUUID()}`,
        ownerEmail: owner,
        staffId: absent.id,
        severity: "hard",
        kind: "unavailable",
        details: JSON.stringify({ from: slot.date, until: slot.date }),
        source: `${absent.name} can't make it on ${longDate(slot.date)} (called off from the ${describeSlot(slot)} shift). Added by the cover step.`,
        status: "confirmed",
        flag: null,
      });
    }

    const sameDayShifts = others
      .filter((a) => a.staffId === absent.id)
      .map((a) => data.input.slots.find((s) => s.id === a.slotId)!)
      .filter((s) => s.date === slot.date)
      .map(describeSlot);

    const message = cover
      ? `Hi ${cover.name}, could you cover the ${slot.label ?? slot.role} shift on ${longDate(slot.date)}, ${slot.start} to ${slot.end}? ${absent.name} can't make it. Please reply to let me know either way. Thank you!`
      : null;
    const summary = cover
      ? `${cover.name} now covers the ${describeSlot(slot)} shift for ${absent.name}. ${absent.name} is marked off on ${longDate(slot.date)}.`
      : `${absent.name} is off the ${describeSlot(slot)} shift and marked off on ${longDate(slot.date)}. The shift is open.`;
    await writeLastChange(tx, owner, {
      kind: "cover",
      slotIds: [slot.id],
      summary,
      ...(message ? { message } : {}),
    });

    return {
      slotId: slot.id,
      slotDescription: describeSlot(slot),
      absentStaffId: absent.id,
      absentName: absent.name,
      coverStaffId: cover?.id ?? null,
      coverName: cover?.name ?? null,
      leftOpen: !cover,
      sameDayShifts,
      offRuleAdded: !already,
      message,
      summary,
    };
  });
}
