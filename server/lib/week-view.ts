import { eq } from "drizzle-orm";

import { getDb } from "../db/index.js";
import { staff as staffTable } from "../db/schema.js";
import { currentFairness, describeSlot, loadSchedule, loadWeekRow, type LastChange } from "./assignments.js";
import { listRuleCards, type RuleCard } from "./rules.js";
import { SAMPLE_MESSAGES } from "./sample.js";
import type { PatternInput } from "./setup.js";

export interface WeekView {
  hasWeek: boolean;
  week: { name: string; startDate: string; isSample: boolean } | null;
  staff: {
    id: string;
    name: string;
    roles: string[];
    maxShifts: number;
    shiftCount: number;
    hourlyRate: number | null;
    overtimeAfterHours: number | null;
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
  /** Every rule, proposed and confirmed. Only confirmed ones are used by the engine. */
  rules: RuleCard[];
  unfilledSlotIds: string[];
  /** Fairness of the schedule as it stands, from the engine. Empty before anything is placed. */
  fairness: {
    people: { staffId: string; name: string; shifts: number; closes: number; weekends: number; hours: number }[];
    averages: { shifts: number; hours: number; closes: number; weekends: number };
  } | null;
  published: { token: string; path: string; publishedAt: string | null } | null;
  lastChange: LastChange | null;
  /** The typical week the shifts were made from, for editing. Null for the sample. */
  setup: { weekStart: string; pattern: PatternInput[] } | null;
  exampleMessages: string | null;
  /** The one thing the manager should do next. */
  nextStep: "setup" | "rules" | "confirm" | "build" | "publish" | "done";
}

export async function buildWeekView(owner: string): Promise<WeekView> {
  const db = getDb();
  const week = await loadWeekRow(db, owner);
  if (!week) {
    return {
      hasWeek: false,
      week: null,
      staff: [],
      slots: [],
      rules: [],
      unfilledSlotIds: [],
      fairness: null,
      published: null,
      lastChange: null,
      setup: null,
      exampleMessages: null,
      nextStep: "setup",
    };
  }
  const { input, assignments } = await loadSchedule(db, owner);
  const ruleCards = await listRuleCards(owner);
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

  let fairness: WeekView["fairness"] = null;
  if (assignments.length > 0) {
    const f = currentFairness(input, assignments);
    fairness = {
      people: f.people.map((p) => ({
        staffId: p.staffId,
        name: byName.get(p.staffId) ?? p.staffId,
        shifts: p.shifts,
        closes: p.closes,
        weekends: p.weekends,
        hours: p.hours,
      })),
      averages: f.averages,
    };
  }

  let setup: WeekView["setup"] = null;
  if (week.pattern) {
    try {
      const p = JSON.parse(week.pattern) as { weekStart: string; pattern: PatternInput[] };
      setup = { weekStart: p.weekStart, pattern: p.pattern };
    } catch {
      setup = null;
    }
  }

  const confirmed = ruleCards.filter((r) => r.status === "confirmed").length;
  const proposed = ruleCards.filter((r) => r.status === "proposed").length;
  const placed = assignments.length;
  let nextStep: WeekView["nextStep"];
  if (proposed > 0) nextStep = "confirm";
  else if (placed === 0 && confirmed === 0) nextStep = "rules";
  else if (placed === 0) nextStep = "build";
  else if (!week.publishedToken) nextStep = "publish";
  else nextStep = "done";

  const staffDb = await db.select().from(staffTable).where(eq(staffTable.ownerEmail, owner));
  const money = new Map(staffDb.map((s) => [s.id, s]));

  return {
    hasWeek: true,
    week: { name: week.name, startDate: week.startDate, isSample: week.isSample },
    staff: input.staff.map((s) => ({
      id: s.id,
      name: s.name,
      roles: s.roles,
      maxShifts: s.maxShifts,
      shiftCount: counts.get(s.id) ?? 0,
      hourlyRate: money.get(s.id)?.hourlyRate ?? null,
      overtimeAfterHours: money.get(s.id)?.overtimeAfterHours ?? null,
    })),
    slots,
    rules: ruleCards,
    unfilledSlotIds: slots.filter((s) => !s.staffId).map((s) => s.id),
    fairness,
    published: week.publishedToken
      ? { token: week.publishedToken, path: `/s/${week.publishedToken}`, publishedAt: week.publishedAt }
      : null,
    lastChange: week.lastChange,
    setup,
    exampleMessages: week.isSample ? SAMPLE_MESSAGES : null,
    nextStep,
  };
}
