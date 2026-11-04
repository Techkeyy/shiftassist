
import { getDb } from "../db/index.js";
import { describeSlot, loadSchedule, loadWeekRow } from "./assignments.js";

export interface WeekView {
  hasWeek: boolean;
  week: { name: string; startDate: string; isSample: boolean } | null;
  staff: {
    id: string;
    name: string;
    roles: string[];
    maxShifts: number;
    shiftCount: number;
  }[];
  slots: {
    id: string;
    date: string;
    start: string;
    end: string;
    role: string;
    label: string;
    description: string;
    staffId: string | null;
    staffName: string | null;
    locked: boolean;
  }[];
  rules: {
    id: string;
    staffId: string;
    staffName: string;
    severity: "hard" | "soft";
    kind: string;
    text: string;
  }[];
  unfilledSlotIds: string[];
}

export async function buildWeekView(owner: string): Promise<WeekView> {
  const db = getDb();
  const week = await loadWeekRow(db, owner);
  if (!week) {
    return { hasWeek: false, week: null, staff: [], slots: [], rules: [], unfilledSlotIds: [] };
  }
  const { input, assignments } = await loadSchedule(db, owner);
  const byName = new Map(input.staff.map((s) => [s.id, s.name]));
  const bySlot = new Map(assignments.map((a) => [a.slotId, a]));
  const counts = new Map<string, number>();
  for (const a of assignments) counts.set(a.staffId, (counts.get(a.staffId) ?? 0) + 1);

  const slots = [...input.slots]
    .sort((a, b) => (a.date + a.start + a.id).localeCompare(b.date + b.start + b.id))
    .map((s) => {
      const a = bySlot.get(s.id);
      return {
        id: s.id,
        date: s.date,
        start: s.start,
        end: s.end,
        role: s.role,
        label: s.label ?? s.role,
        description: describeSlot(s),
        staffId: a?.staffId ?? null,
        staffName: a ? (byName.get(a.staffId) ?? null) : null,
        locked: a?.locked ?? false,
      };
    });

  return {
    hasWeek: true,
    week: { name: week.name, startDate: week.startDate, isSample: week.isSample },
    staff: input.staff.map((s) => ({
      id: s.id,
      name: s.name,
      roles: s.roles,
      maxShifts: s.maxShifts,
      shiftCount: counts.get(s.id) ?? 0,
    })),
    slots,
    rules: input.rules.map((r) => ({
      id: r.id,
      staffId: r.staffId,
      staffName: byName.get(r.staffId) ?? r.staffId,
      severity: r.severity,
      kind: r.kind,
      text: r.source ?? r.kind,
    })),
    unfilledSlotIds: slots.filter((s) => !s.staffId).map((s) => s.id),
  };
}

