import type { Assignment, Rule, SchedulingInput, Slot, Staff, Violation } from "./types";

export const DAY_MIN = 1440;
const CLOSE_FROM_MIN = 22 * 60;
const MS_PER_DAY = 86400000;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function cmpText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Absolute minutes: days since 1970-01-01 (UTC) times 1440, plus minutes of day. */
export interface Interval {
  s: number;
  e: number;
  dn: number;
  wd: number;
  close: boolean;
  weekend: boolean;
  hours: number;
}

export interface Model {
  staff: Staff[];
  staffById: Map<string, Staff>;
  staffIdx: Map<string, number>;
  slots: Slot[];
  slotById: Map<string, Slot>;
  iv: Map<string, Interval>;
  rulesByStaff: Map<string, Rule[]>;
}

export interface Evaluation {
  hard: Violation[];
  soft: Violation[];
}

export function parseDayNumber(value: string, what: string): number {
  const m = DATE_RE.exec(value);
  if (!m) throw new Error(`${what} must be a YYYY-MM-DD date, got "${value}"`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    throw new Error(`${what} is not a real calendar date: "${value}"`);
  }
  return ms / MS_PER_DAY;
}

export function parseMinutes(value: string, what: string): number {
  const m = TIME_RE.exec(value);
  if (!m) throw new Error(`${what} must be HH:MM, got "${value}"`);
  return Number(m[1]) * 60 + Number(m[2]);
}

function intervalOf(slot: Slot): Interval {
  const dn = parseDayNumber(slot.date, `Slot ${slot.id} date`);
  const sm = parseMinutes(slot.start, `Slot ${slot.id} start`);
  const em = parseMinutes(slot.end, `Slot ${slot.id} end`);
  const s = dn * DAY_MIN + sm;
  let e = dn * DAY_MIN + em;
  if (em <= sm) e += DAY_MIN;
  const wd = new Date(dn * MS_PER_DAY).getUTCDay();
  const endRel = e - dn * DAY_MIN;
  return {
    s,
    e,
    dn,
    wd,
    close: endRel >= CLOSE_FROM_MIN,
    weekend: wd === 0 || wd === 6,
    hours: (e - s) / 60,
  };
}

function validateRule(rule: Rule): void {
  if (rule.severity !== "hard" && rule.severity !== "soft") {
    throw new Error(`Rule ${rule.id} has an invalid severity`);
  }
  switch (rule.kind) {
    case "unavailable":
      if (rule.from !== undefined) parseDayNumber(rule.from, `Rule ${rule.id} from`);
      if (rule.until !== undefined) parseDayNumber(rule.until, `Rule ${rule.id} until`);
      if (rule.afterTime !== undefined) parseMinutes(rule.afterTime, `Rule ${rule.id} afterTime`);
      if (rule.beforeTime !== undefined) parseMinutes(rule.beforeTime, `Rule ${rule.id} beforeTime`);
      if (rule.weekdays !== undefined && rule.weekdays.some((w) => !Number.isInteger(w) || w < 0 || w > 6)) {
        throw new Error(`Rule ${rule.id} weekdays must be integers 0 (Sun) to 6 (Sat)`);
      }
      return;
    case "no_double":
      return;
    case "max_shifts":
      if (!Number.isInteger(rule.max) || rule.max < 0) throw new Error(`Rule ${rule.id} max must be a whole number`);
      return;
    case "min_rest":
      if (!Number.isFinite(rule.hours) || rule.hours < 0) throw new Error(`Rule ${rule.id} hours must be a number >= 0`);
      return;
    default:
      throw new Error("Rule has an unknown kind");
  }
}

function byId<T extends { id: string }>(a: T, b: T): number {
  return cmpText(a.id, b.id);
}

export function buildModel(input: SchedulingInput): Model {
  const staff = [...input.staff].sort(byId);
  const staffById = new Map<string, Staff>();
  const staffIdx = new Map<string, number>();
  staff.forEach((s, i) => {
    if (staffById.has(s.id)) throw new Error(`Duplicate staff id: ${s.id}`);
    if (!Number.isInteger(s.maxShifts) || s.maxShifts < 0) {
      throw new Error(`Staff ${s.id} has an invalid maxShifts: ${s.maxShifts}`);
    }
    staffById.set(s.id, s);
    staffIdx.set(s.id, i);
  });

  const slots = [...input.slots].sort(byId);
  const slotById = new Map<string, Slot>();
  const iv = new Map<string, Interval>();
  for (const slot of slots) {
    if (slotById.has(slot.id)) throw new Error(`Duplicate slot id: ${slot.id}`);
    slotById.set(slot.id, slot);
    iv.set(slot.id, intervalOf(slot));
  }

  const rulesByStaff = new Map<string, Rule[]>();
  for (const rule of [...input.rules].sort(byId)) {
    if (!staffById.has(rule.staffId)) {
      throw new Error(`Rule ${rule.id} refers to unknown staff id: ${rule.staffId}`);
    }
    validateRule(rule);
    let list = rulesByStaff.get(rule.staffId);
    if (list === undefined) {
      list = [];
      rulesByStaff.set(rule.staffId, list);
    }
    list.push(rule);
  }

  return { staff, staffById, staffIdx, slots, slotById, iv, rulesByStaff };
}

export function requireStaff(model: Model, staffId: string): void {
  if (!model.staffById.has(staffId)) throw new Error(`Unknown staff id: ${staffId}`);
}

export function requireSlot(model: Model, slotId: string): void {
  if (!model.slotById.has(slotId)) throw new Error(`Unknown slot id: ${slotId}`);
}

/** Occupancy of a schedule: which slots each person holds, and who holds each slot. */
export class Sched {
  readonly byStaff = new Map<string, string[]>();
  readonly bySlot = new Map<string, string>();

  add(slotId: string, staffId: string): void {
    this.bySlot.set(slotId, staffId);
    let list = this.byStaff.get(staffId);
    if (list === undefined) {
      list = [];
      this.byStaff.set(staffId, list);
    }
    list.push(slotId);
  }

  remove(slotId: string): void {
    const staffId = this.bySlot.get(slotId);
    if (staffId === undefined) return;
    this.bySlot.delete(slotId);
    const list = this.byStaff.get(staffId)!;
    list.splice(list.indexOf(slotId), 1);
  }
}

export function buildSched(model: Model, assignments: Assignment[]): Sched {
  const sched = new Sched();
  const sorted = [...assignments].sort((a, b) => cmpText(a.slotId, b.slotId));
  for (const a of sorted) {
    requireStaff(model, a.staffId);
    requireSlot(model, a.slotId);
    if (sched.bySlot.has(a.slotId)) throw new Error(`Slot ${a.slotId} has more than one assignment`);
    sched.add(a.slotId, a.staffId);
  }
  return sched;
}

export function describeSlot(slot: Slot): string {
  return `${slot.date} ${slot.start}-${slot.end} ${slot.role}`;
}

function fmtDate(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

function formatHours(gapMinutes: number): string {
  return `${Number((gapMinutes / 60).toFixed(1))} hours`;
}

function unavailableText(name: string, rule: Rule & { kind: "unavailable" }): string {
  let time: string;
  if (rule.afterTime !== undefined && rule.beforeTime !== undefined) {
    time = `can't work before ${rule.beforeTime} or after ${rule.afterTime}`;
  } else if (rule.afterTime !== undefined) {
    time = `can't work after ${rule.afterTime}`;
  } else if (rule.beforeTime !== undefined) {
    time = `can't work before ${rule.beforeTime}`;
  } else {
    time = "can't work";
  }
  const parts = [time];
  if (rule.weekdays !== undefined && rule.weekdays.length > 0) {
    const names = [...new Set(rule.weekdays)].sort((a, b) => a - b).map((w) => WEEKDAYS[w]);
    parts.push(`on ${names.join(", ")}`);
  }
  if (rule.from !== undefined && rule.until !== undefined) {
    parts.push(`from ${fmtDate(rule.from)} until ${fmtDate(rule.until)}`);
  } else if (rule.from !== undefined) {
    parts.push(`from ${fmtDate(rule.from)}`);
  } else if (rule.until !== undefined) {
    parts.push(`until ${fmtDate(rule.until)}`);
  }
  return `${name} ${parts.join(" ")}.`;
}

/**
 * An unavailable rule matches when the date conditions hold on the slot's start date and,
 * if times are given, the shift overlaps [afterTime, midnight) or [midnight, beforeTime)
 * on that date.
 */
function unavailableMatches(rule: Rule & { kind: "unavailable" }, date: string, iv: Interval): boolean {
  if (rule.from !== undefined && date < rule.from) return false;
  if (rule.until !== undefined && date > rule.until) return false;
  if (rule.weekdays !== undefined && !rule.weekdays.includes(iv.wd)) return false;
  if (rule.afterTime === undefined && rule.beforeTime === undefined) return true;
  const base = iv.dn * DAY_MIN;
  const windows: [number, number][] = [];
  if (rule.afterTime !== undefined) windows.push([base + parseMinutes(rule.afterTime, "afterTime"), base + DAY_MIN]);
  if (rule.beforeTime !== undefined) windows.push([base, base + parseMinutes(rule.beforeTime, "beforeTime")]);
  return windows.some(([ws, we]) => iv.s < we && ws < iv.e);
}

interface Hit {
  code: string;
  message: string;
}

function ruleHits(
  model: Model,
  rule: Rule,
  staff: Staff,
  slot: Slot,
  iv: Interval,
  others: string[],
): Hit[] {
  const name = staff.name;
  switch (rule.kind) {
    case "unavailable":
      return unavailableMatches(rule, slot.date, iv)
        ? [{ code: "unavailable", message: unavailableText(name, rule) }]
        : [];
    case "no_double":
      return others.some((o) => model.slotById.get(o)!.date === slot.date)
        ? [{ code: "no_double", message: `${name} already has a shift on ${slot.date}.` }]
        : [];
    case "max_shifts":
      return others.length + 1 > rule.max
        ? [{ code: "max_shifts", message: `${name} would work ${others.length + 1} shifts, over the limit of ${rule.max}.` }]
        : [];
    case "min_rest": {
      const hits: Hit[] = [];
      for (const oid of others) {
        const oi = model.iv.get(oid)!;
        if (iv.s < oi.e && oi.s < iv.e) continue;
        const gap = iv.s >= oi.e ? iv.s - oi.e : oi.s - iv.e;
        if (gap < rule.hours * 60) {
          hits.push({
            code: "min_rest",
            message: `${name} would have only ${formatHours(gap)} between shifts, under the ${rule.hours}-hour minimum rest.`,
          });
        }
      }
      return hits;
    }
    default:
      return [];
  }
}

/**
 * Evaluates putting staffId on slotId against the rest of the schedule. Any assignment
 * already on this slot for this same person is ignored, so a locked or placed
 * assignment can be re-checked in place.
 */
export function evaluate(model: Model, sched: Sched, staffId: string, slotId: string): Evaluation {
  const staff = model.staffById.get(staffId)!;
  const slot = model.slotById.get(slotId)!;
  const iv = model.iv.get(slotId)!;
  const name = staff.name;
  const hard: Violation[] = [];
  const soft: Violation[] = [];

  if (!staff.roles.includes(slot.role)) {
    hard.push({ code: "role", message: `${name} doesn't have the ${slot.role} role.` });
  }
  const takenBy = sched.bySlot.get(slotId);
  if (takenBy !== undefined && takenBy !== staffId) {
    hard.push({
      code: "slot_taken",
      message: `The ${describeSlot(slot)} shift is already filled by ${model.staffById.get(takenBy)!.name}.`,
    });
  }

  const others: string[] = [];
  for (const oid of sched.byStaff.get(staffId) ?? []) {
    if (oid !== slotId) others.push(oid);
  }
  for (const oid of others) {
    const oi = model.iv.get(oid)!;
    if (iv.s < oi.e && oi.s < iv.e) {
      hard.push({
        code: "overlap",
        message: `${name} is already on ${describeSlot(model.slotById.get(oid)!)}, which overlaps this shift.`,
      });
    }
  }
  if (others.length + 1 > staff.maxShifts) {
    hard.push({ code: "staff_max_shifts", message: `${name} is already at the limit of ${staff.maxShifts} shifts.` });
  }

  for (const rule of model.rulesByStaff.get(staffId) ?? []) {
    const bucket = rule.severity === "hard" ? hard : soft;
    for (const hit of ruleHits(model, rule, staff, slot, iv, others)) {
      bucket.push({ ruleId: rule.id, code: hit.code, message: hit.message });
    }
  }
  return { hard, soft };
}
