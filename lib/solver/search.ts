import type { Alternative, Assignment, Fairness, LockedViolation, SolveResult, Trace, Unfilled } from "./types";
import { buildSched, cmpText, evaluate } from "./model";
import type { Model, Sched } from "./model";

/** Maximum number of candidate evaluations the search may perform. */
export const NODE_LIMIT = 200000;

export type Placement = [string, string];

interface Counts {
  shifts: number[];
  closes: number[];
  weekends: number[];
}

interface Candidate {
  staffId: string;
  pref: number;
  soft: number;
  closes: number;
  weekends: number;
  shifts: number;
}

interface Best {
  key: number[];
  placed: Placement[];
}

/** Reads an element whose index the caller has already bounds-checked. Throws rather than return undefined. */
function valueAt(values: number[], k: number): number {
  const v = values[k];
  if (v === undefined) throw new Error(`index ${k} is outside a list of length ${values.length}`);
  return v;
}

export function compareKeys(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = valueAt(a, i);
    const y = valueAt(b, i);
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

function spread(values: number[]): number {
  return values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);
}

export function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((x, y) => x + y, 0) / values.length;
}

/**
 * Backtracking search over the open slots, in most-constrained-first order. Each slot is
 * either given an eligible person or left open. Objective, in order: fewest unfilled slots,
 * fewest changes from `prefer`, fewest soft violations, then the spread of closes, weekend
 * shifts and total shifts. `base` is mutated during the search and restored before returning.
 */
export function searchPlacements(
  model: Model,
  base: Sched,
  open: string[],
  prefer: Map<string, string>,
): Placement[] {
  const n = model.staff.length;
  const counts: Counts = {
    shifts: new Array<number>(n).fill(0),
    closes: new Array<number>(n).fill(0),
    weekends: new Array<number>(n).fill(0),
  };
  const bump = (staffId: string, slotId: string, delta: number): void => {
    const k = model.staffIdx.get(staffId)!;
    const iv = model.iv.get(slotId)!;
    counts.shifts[k] = valueAt(counts.shifts, k) + delta;
    if (iv.close) counts.closes[k] = valueAt(counts.closes, k) + delta;
    if (iv.weekend) counts.weekends[k] = valueAt(counts.weekends, k) + delta;
  };
  for (const [staffId, slotIds] of base.byStaff) {
    for (const slotId of slotIds) bump(staffId, slotId, 1);
  }

  const eligible = new Map<string, number>();
  for (const slotId of open) {
    const role = model.slotById.get(slotId)!.role;
    let count = 0;
    for (const st of model.staff) {
      if (st.roles.includes(role) && evaluate(model, base, st.id, slotId).hard.length === 0) count++;
    }
    eligible.set(slotId, count);
  }
  const order = [...open].sort((a, b) => eligible.get(a)! - eligible.get(b)! || cmpText(a, b));

  const state: { best: Best | null; evals: number } = { best: null, evals: 0 };
  const current: Placement[] = [];

  const dfs = (i: number, unfilled: number, changes: number, soft: number): void => {
    if (state.best !== null) {
      if (state.evals >= NODE_LIMIT) return;
      if (compareKeys([unfilled, changes, soft], state.best.key) > 0) return;
    }
    if (i === order.length) {
      const key = [unfilled, changes, soft, spread(counts.closes), spread(counts.weekends), spread(counts.shifts)];
      if (state.best === null || compareKeys(key, state.best.key) < 0) {
        state.best = { key, placed: current.slice() };
      }
      return;
    }

    const slotId = order[i];
    if (slotId === undefined) throw new Error(`search position ${i} is past the ${order.length} open slots`);
    const slot = model.slotById.get(slotId)!;
    const iv = model.iv.get(slotId)!;
    const prev = prefer.get(slotId);
    const cands: Candidate[] = [];
    for (const st of model.staff) {
      if (!st.roles.includes(slot.role)) continue;
      state.evals++;
      const ev = evaluate(model, base, st.id, slotId);
      if (ev.hard.length > 0) continue;
      const k = model.staffIdx.get(st.id)!;
      cands.push({
        staffId: st.id,
        pref: prev === st.id ? 0 : 1,
        soft: ev.soft.length,
        closes: valueAt(counts.closes, k) + (iv.close ? 1 : 0),
        weekends: valueAt(counts.weekends, k) + (iv.weekend ? 1 : 0),
        shifts: valueAt(counts.shifts, k) + 1,
      });
    }
    cands.sort(
      (a, b) =>
        a.pref - b.pref ||
        a.soft - b.soft ||
        a.closes - b.closes ||
        a.weekends - b.weekends ||
        a.shifts - b.shifts ||
        cmpText(a.staffId, b.staffId),
    );

    for (const c of cands) {
      if (state.best !== null && state.evals >= NODE_LIMIT) return;
      base.add(slotId, c.staffId);
      bump(c.staffId, slotId, 1);
      current.push([slotId, c.staffId]);
      dfs(i + 1, unfilled, changes + (prev !== undefined && prev !== c.staffId ? 1 : 0), soft + c.soft);
      current.pop();
      bump(c.staffId, slotId, -1);
      base.remove(slotId);
    }

    if (state.best !== null && state.evals >= NODE_LIMIT) return;
    dfs(i + 1, unfilled + 1, changes + (prev !== undefined ? 1 : 0), soft);
  };

  dfs(0, 0, 0, 0);
  return state.best === null ? [] : state.best.placed;
}

export interface Stats {
  shifts: number[];
  hours: number[];
  closes: number[];
  weekends: number[];
}

export function computeStats(model: Model, sched: Sched): Stats {
  const n = model.staff.length;
  const stats: Stats = {
    shifts: new Array<number>(n).fill(0),
    hours: new Array<number>(n).fill(0),
    closes: new Array<number>(n).fill(0),
    weekends: new Array<number>(n).fill(0),
  };
  for (const [staffId, slotIds] of sched.byStaff) {
    const k = model.staffIdx.get(staffId)!;
    for (const slotId of slotIds) {
      const iv = model.iv.get(slotId)!;
      stats.shifts[k] = valueAt(stats.shifts, k) + 1;
      stats.hours[k] = valueAt(stats.hours, k) + iv.hours;
      if (iv.close) stats.closes[k] = valueAt(stats.closes, k) + 1;
      if (iv.weekend) stats.weekends[k] = valueAt(stats.weekends, k) + 1;
    }
  }
  return stats;
}

export function buildTrace(
  model: Model,
  sched: Sched,
  stats: Stats,
  slotId: string,
  lockedSlots: Set<string>,
): Trace {
  const slot = model.slotById.get(slotId)!;
  const staffId = sched.bySlot.get(slotId) ?? null;
  const locked = lockedSlots.has(slotId);
  const alternatives: Alternative[] = model.staff.map((st) => {
    const ev = evaluate(model, sched, st.id, slotId);
    return {
      staffId: st.id,
      name: st.name,
      blockedBy: ev.hard.map((v) => v.message),
      wouldBreakSoft: ev.soft.map((v) => v.message),
      allowed: ev.hard.length === 0,
    };
  });

  const reasons: string[] = [];
  if (staffId === null) {
    const qualified = model.staff.filter((st) => st.roles.includes(slot.role));
    if (qualified.length === 0) reasons.push(`No one on the team has the ${slot.role} role.`);
    for (const alt of alternatives) {
      if (!model.staffById.get(alt.staffId)!.roles.includes(slot.role)) continue;
      reasons.push(
        alt.allowed
          ? `${alt.name} passes every hard check, but the best schedule found does not place them here.`
          : `${alt.name}: ${alt.blockedBy.join(" ")}`,
      );
    }
  } else {
    const st = model.staffById.get(staffId)!;
    const k = model.staffIdx.get(staffId)!;
    if (locked) reasons.push("Locked by the manager.");
    const own = evaluate(model, sched, staffId, slotId);
    if (locked) {
      for (const v of own.hard) reasons.push(`Kept although it breaks a hard rule: ${v.message}`);
    }
    reasons.push(
      st.roles.includes(slot.role) ? `Has the ${slot.role} role.` : `Does not have the ${slot.role} role.`,
    );
    reasons.push(
      `Has ${countOf(valueAt(stats.closes, k), "close", "closes")} this week, the team average is ${average(stats.closes).toFixed(1)}.`,
    );
    reasons.push(
      `Has ${countOf(valueAt(stats.weekends, k), "weekend shift", "weekend shifts")} this week, the team average is ${average(stats.weekends).toFixed(1)}.`,
    );
    reasons.push(
      `Has ${countOf(valueAt(stats.shifts, k), "shift", "shifts")} this week, the team average is ${average(stats.shifts).toFixed(1)}.`,
    );
    for (const v of own.soft) reasons.push(`Breaks a soft rule: ${v.message}`);
  }

  return { slotId, staffId, locked, reasons, alternatives };
}

export interface Finished {
  result: SolveResult;
  sched: Sched;
}

/** Builds the output for locked assignments plus the placements chosen by the search. */
export function finish(model: Model, locked: Assignment[], placed: Placement[]): Finished {
  const lockedSlots = new Set(locked.map((a) => a.slotId));
  const assignments: Assignment[] = [
    ...locked.map((a) => ({ slotId: a.slotId, staffId: a.staffId, locked: true })),
    ...placed.map(([slotId, staffId]) => ({ slotId, staffId, locked: false })),
  ].sort((a, b) => cmpText(a.slotId, b.slotId));
  const sched = buildSched(model, assignments);
  const stats = computeStats(model, sched);

  const lockedViolations: LockedViolation[] = [];
  for (const a of assignments) {
    if (!a.locked) continue;
    const hard = evaluate(model, sched, a.staffId, a.slotId).hard;
    if (hard.length > 0) lockedViolations.push({ slotId: a.slotId, staffId: a.staffId, violations: hard });
  }

  const traces: Record<string, Trace> = {};
  const unfilled: Unfilled[] = [];
  for (const slot of model.slots) {
    const trace = buildTrace(model, sched, stats, slot.id, lockedSlots);
    traces[slot.id] = trace;
    if (trace.staffId === null) unfilled.push({ slotId: slot.id, reasons: trace.reasons });
  }

  const fairness: Fairness = {
    people: model.staff.map((st, k) => ({
      staffId: st.id,
      shifts: valueAt(stats.shifts, k),
      hours: valueAt(stats.hours, k),
      closes: valueAt(stats.closes, k),
      weekends: valueAt(stats.weekends, k),
    })),
    averages: {
      shifts: average(stats.shifts),
      hours: average(stats.hours),
      closes: average(stats.closes),
      weekends: average(stats.weekends),
    },
  };

  return {
    result: { assignments, unfilled, traces, fairness, lockedViolations },
    sched,
  };
}

function countOf(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
