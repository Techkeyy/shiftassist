import { NoWriteError } from "@agent-native/core/action";
import { and, eq } from "drizzle-orm";

import {
  checkAssignment,
  repairWeek,
  type Assignment,
  type Rule,
  type SchedulingInput,
  type Slot,
  type Staff,
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
}

function refuse(
  message: string,
  errorCode: string,
  details?: Record<string, unknown>,
): never {
  throw new NoWriteError(message, {
    errorCode,
    statusCode: errorCode === "rule_violation" ? 409 : 404,
    ...(details ? { details } : {}),
  });
}

export function describeSlot(slot: Slot): string {
  return `${slot.label ?? slot.role} on ${slot.date} ${slot.start}-${slot.end}`;
}

export async function loadWeekRow(
  db: DbLike,
  owner: string,
): Promise<WeekRow | null> {
  const [w] = await db.select().from(weeks).where(eq(weeks.ownerEmail, owner));
  return w
    ? { id: w.id, name: w.name, startDate: w.startDate, isSample: w.isSample }
    : null;
}

/** Everything one owner has, in the shapes the solver expects. Always filtered by owner. */
export async function loadSchedule(
  db: DbLike,
  owner: string,
): Promise<Schedule> {
  const [staffRows, slotRows, ruleRows, asgRows] = await Promise.all([
    db.select().from(staff).where(eq(staff.ownerEmail, owner)),
    db.select().from(slots).where(eq(slots.ownerEmail, owner)),
    db.select().from(rules).where(eq(rules.ownerEmail, owner)),
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
  const ruleList: Rule[] = ruleRows.map(
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
    return { ...base, changed: true, locked, displaced, repaired, message };
  });
}
