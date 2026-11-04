import type {
  Assignment,
  CheckResult,
  CoverOption,
  RepairResult,
  SchedulingInput,
  SolveInput,
  SolveResult,
  Staff,
} from "./types";
import { buildModel, buildSched, cmpText, evaluate, requireSlot, requireStaff } from "./model";
import type { Model } from "./model";
import { compareKeys, finish, searchPlacements } from "./search";
import type { Placement } from "./search";

export * from "./types";

function requireRefs(model: Model, assignments: Assignment[]): void {
  for (const a of assignments) {
    requireStaff(model, a.staffId);
    requireSlot(model, a.slotId);
  }
}

/** Hard violations for putting candidate.staffId on candidate.slotId, given the other assignments. */
export function checkAssignment(
  input: SchedulingInput,
  assignments: Assignment[],
  candidate: { slotId: string; staffId: string },
): CheckResult {
  const model = buildModel(input);
  requireRefs(model, assignments);
  requireStaff(model, candidate.staffId);
  requireSlot(model, candidate.slotId);
  const sched = buildSched(model, assignments);
  const { hard } = evaluate(model, sched, candidate.staffId, candidate.slotId);
  return { ok: hard.length === 0, violations: hard };
}

/** Solves the whole week. Locked assignments are kept; every other slot is re-solved. */
export function solveWeek(input: SolveInput): SolveResult {
  const model = buildModel(input);
  const all = input.assignments ?? [];
  requireRefs(model, all);
  const locked = all.filter((a) => a.locked);
  const base = buildSched(model, locked);
  const open = model.slots.map((s) => s.id).filter((id) => !base.bySlot.has(id));
  const placed = searchPlacements(model, base, open, new Map<string, string>());
  return finish(model, locked, placed).result;
}

function repairCost(
  model: Model,
  lockedSlots: Set<string>,
  placed: Placement[],
  prefer: Map<string, string>,
): number[] {
  const got = new Map<string, string>(placed);
  let unfilled = 0;
  for (const s of model.slots) {
    if (!lockedSlots.has(s.id) && !got.has(s.id)) unfilled++;
  }
  let changes = 0;
  for (const [slotId, staffId] of prefer) {
    if (got.get(slotId) !== staffId) changes++;
  }
  return [unfilled, changes];
}

/**
 * Repairs a previous schedule after a change. Locked assignments stay fixed. Previous
 * assignments are kept wherever they still pass every hard check, and only the remaining
 * slots are searched. If that leaves a slot unfilled, a full search that prefers the previous
 * people is also run, and the result with fewer unfilled slots, then fewer changes, wins.
 */
export function repairWeek(input: SchedulingInput, previous: Assignment[]): RepairResult {
  const model = buildModel(input);
  requireRefs(model, previous);
  buildSched(model, previous);
  const locked = previous.filter((a) => a.locked);
  const lockedSlots = new Set(locked.map((a) => a.slotId));
  const prefer = new Map<string, string>();
  for (const a of previous) {
    if (!a.locked) prefer.set(a.slotId, a.staffId);
  }

  const baseA = buildSched(model, locked);
  const keptPlacements: Placement[] = [];
  for (const slotId of [...prefer.keys()].sort(cmpText)) {
    const staffId = prefer.get(slotId)!;
    if (evaluate(model, baseA, staffId, slotId).hard.length === 0) {
      baseA.add(slotId, staffId);
      keptPlacements.push([slotId, staffId]);
    }
  }
  const openA = model.slots.map((s) => s.id).filter((id) => !baseA.bySlot.has(id));
  const placedA: Placement[] = [
    ...keptPlacements,
    ...searchPlacements(model, baseA, openA, new Map<string, string>()),
  ];

  let placed = placedA;
  const costA = repairCost(model, lockedSlots, placedA, prefer);
  if (costA[0] > 0) {
    const baseB = buildSched(model, locked);
    const openB = model.slots.map((s) => s.id).filter((id) => !baseB.bySlot.has(id));
    const placedB = searchPlacements(model, baseB, openB, prefer);
    if (compareKeys(repairCost(model, lockedSlots, placedB, prefer), costA) < 0) placed = placedB;
  }

  const { result, sched } = finish(model, locked, placed);
  const moved: RepairResult["moved"] = [];
  for (const slotId of [...prefer.keys()].sort(cmpText)) {
    const fromStaffId = prefer.get(slotId)!;
    const toStaffId = sched.bySlot.get(slotId) ?? null;
    if (toStaffId !== fromStaffId) moved.push({ slotId, fromStaffId, toStaffId });
  }
  return { ...result, moved };
}

function overtimeCostOf(staff: Staff, hours: number): number {
  if (staff.hourlyRate === undefined || staff.overtimeAfterHours === undefined) return 0;
  const over = Math.max(0, hours - staff.overtimeAfterHours);
  return over * staff.hourlyRate * 1.5;
}

/**
 * People who could cover an open slot. The slot is treated as open even if it is assigned
 * in `assignments`. Only people who pass every hard check are returned.
 */
export function findCover(input: SchedulingInput, assignments: Assignment[], slotId: string): CoverOption[] {
  const model = buildModel(input);
  requireRefs(model, assignments);
  requireSlot(model, slotId);
  const sched = buildSched(model, assignments.filter((a) => a.slotId !== slotId));
  const slot = model.slotById.get(slotId)!;
  const iv = model.iv.get(slotId)!;

  const options: CoverOption[] = [];
  for (const st of model.staff) {
    if (!st.roles.includes(slot.role)) continue;
    const ev = evaluate(model, sched, st.id, slotId);
    if (ev.hard.length > 0) continue;

    const mine = sched.byStaff.get(st.id) ?? [];
    let hours = iv.hours;
    let closes = iv.close ? 1 : 0;
    let weekends = iv.weekend ? 1 : 0;
    for (const oid of mine) {
      const oi = model.iv.get(oid)!;
      hours += oi.hours;
      if (oi.close) closes++;
      if (oi.weekend) weekends++;
    }
    const shiftsAfter = mine.length + 1;
    const overtimeCost = overtimeCostOf(st, hours);

    const reasons = [
      `Has the ${slot.role} role.`,
      `Would have ${shiftsAfter} shifts, ${hours} hours, ${closes} closes and ${weekends} weekend shifts this week.`,
    ];
    if (ev.soft.length === 0) reasons.push("Breaks no soft rules.");
    for (const v of ev.soft) reasons.push(`Breaks a soft rule: ${v.message}`);
    if (st.overtimeAfterHours !== undefined && st.hourlyRate !== undefined) {
      reasons.push(
        overtimeCost > 0
          ? `Would go over the ${st.overtimeAfterHours}-hour overtime threshold.`
          : `Stays within the ${st.overtimeAfterHours}-hour overtime threshold.`,
      );
    }

    options.push({
      staffId: st.id,
      name: st.name,
      allowed: true,
      softViolations: ev.soft.map((v) => v.message),
      overtimeCost,
      closesAfter: closes,
      shiftsAfter,
      reasons,
    });
  }

  options.sort(
    (a, b) =>
      a.softViolations.length - b.softViolations.length ||
      a.overtimeCost - b.overtimeCost ||
      a.shiftsAfter - b.shiftsAfter ||
      cmpText(a.staffId, b.staffId),
  );
  return options;
}
