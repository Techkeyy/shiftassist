import { describe, expect, it } from "vitest";
import { checkAssignment, findCover, repairWeek, solveWeek } from "./index";
import type { Assignment, Rule, SchedulingInput, Slot, Staff } from "./types";

// ---------------------------------------------------------------------------
// Independent checker. Deliberately does not use the engine's code.
// ---------------------------------------------------------------------------

function dayNo(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function minOf(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function spanOf(slot: Slot): { s: number; e: number; day: number } {
  const day = dayNo(slot.date) * 1440;
  const sm = minOf(slot.start);
  const em = minOf(slot.end);
  return { s: day + sm, e: day + em + (em <= sm ? 1440 : 0), day };
}

function isCloseShift(slot: Slot): boolean {
  const sp = spanOf(slot);
  return sp.e - sp.day >= 22 * 60;
}

/** Returns a list of hard-rule problems. An empty list means the schedule is valid. */
function independentProblems(input: SchedulingInput, assignments: Assignment[]): string[] {
  const problems: string[] = [];
  const staffById = new Map(input.staff.map((s) => [s.id, s] as const));
  const slotById = new Map(input.slots.map((s) => [s.id, s] as const));
  const seen = new Set<string>();
  const byStaff = new Map<string, Slot[]>();

  for (const a of assignments) {
    if (seen.has(a.slotId)) problems.push(`slot ${a.slotId} is filled twice`);
    seen.add(a.slotId);
    const staff = staffById.get(a.staffId);
    const slot = slotById.get(a.slotId);
    if (!staff || !slot) {
      problems.push(`unknown ids in ${a.slotId}/${a.staffId}`);
      continue;
    }
    if (!staff.roles.includes(slot.role)) problems.push(`${staff.name} lacks ${slot.role} for ${slot.id}`);
    const list = byStaff.get(staff.id) ?? [];
    list.push(slot);
    byStaff.set(staff.id, list);
  }

  for (const [staffId, slots] of byStaff) {
    const staff = staffById.get(staffId)!;
    if (slots.length > staff.maxShifts) problems.push(`${staff.name} has ${slots.length} shifts, max ${staff.maxShifts}`);
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = spanOf(slots[i]);
        const b = spanOf(slots[j]);
        if (a.s < b.e && b.s < a.e) problems.push(`${staff.name} overlaps ${slots[i].id} and ${slots[j].id}`);
      }
    }
    for (const rule of input.rules.filter((r) => r.staffId === staffId && r.severity === "hard")) {
      problems.push(...ruleProblems(staff, rule, slots));
    }
  }
  return problems;
}

function ruleProblems(staff: Staff, rule: Rule, slots: Slot[]): string[] {
  const out: string[] = [];
  switch (rule.kind) {
    case "unavailable": {
      for (const slot of slots) {
        const wd = new Date(dayNo(slot.date) * 86400000).getUTCDay();
        if (rule.from !== undefined && slot.date < rule.from) continue;
        if (rule.until !== undefined && slot.date > rule.until) continue;
        if (rule.weekdays !== undefined && !rule.weekdays.includes(wd)) continue;
        if (rule.afterTime === undefined && rule.beforeTime === undefined) {
          out.push(`${staff.name} unavailable on ${slot.id} (${rule.id})`);
          continue;
        }
        const sp = spanOf(slot);
        const windows: [number, number][] = [];
        if (rule.afterTime !== undefined) windows.push([sp.day + minOf(rule.afterTime), sp.day + 1440]);
        if (rule.beforeTime !== undefined) windows.push([sp.day, sp.day + minOf(rule.beforeTime)]);
        if (windows.some(([ws, we]) => sp.s < we && ws < sp.e)) out.push(`${staff.name} unavailable on ${slot.id} (${rule.id})`);
      }
      return out;
    }
    case "no_double": {
      const dates = slots.map((s) => s.date);
      if (new Set(dates).size !== dates.length) out.push(`${staff.name} has two shifts on one date (${rule.id})`);
      return out;
    }
    case "max_shifts":
      if (slots.length > rule.max) out.push(`${staff.name} exceeds max_shifts ${rule.max} (${rule.id})`);
      return out;
    case "min_rest": {
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const a = spanOf(slots[i]);
          const b = spanOf(slots[j]);
          if (a.s < b.e && b.s < a.e) continue;
          const gap = a.s >= b.e ? a.s - b.e : b.s - a.e;
          if (gap < rule.hours * 60) out.push(`${staff.name} min_rest broken (${rule.id})`);
        }
      }
      return out;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Realistic fixture: 15 staff, 7 days (Mon 2026-11-02 to Sun 2026-11-08), 47 slots.
// ---------------------------------------------------------------------------

const DAYS = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"];

const fixtureStaff: Staff[] = [
  { id: "s01", name: "Ava", roles: ["bar", "manager"], maxShifts: 5 },
  { id: "s02", name: "Ben", roles: ["bar"], maxShifts: 5 },
  { id: "s03", name: "Cleo", roles: ["bar", "server"], maxShifts: 5 },
  { id: "s04", name: "Dan", roles: ["server"], maxShifts: 5 },
  { id: "s05", name: "Eli", roles: ["server"], maxShifts: 5 },
  { id: "s06", name: "Fay", roles: ["server", "bar"], maxShifts: 4 },
  { id: "s07", name: "Gus", roles: ["kitchen"], maxShifts: 5 },
  { id: "s08", name: "Hana", roles: ["kitchen"], maxShifts: 5 },
  { id: "s09", name: "Ivan", roles: ["kitchen", "server"], maxShifts: 5 },
  { id: "s10", name: "Jo", roles: ["kitchen"], maxShifts: 4 },
  { id: "s11", name: "Kai", roles: ["manager", "server"], maxShifts: 3, hourlyRate: 20, overtimeAfterHours: 30 },
  { id: "s12", name: "Lee", roles: ["bar"], maxShifts: 4 },
  { id: "s13", name: "Mia", roles: ["server"], maxShifts: 5 },
  { id: "s14", name: "Nico", roles: ["kitchen"], maxShifts: 5 },
  { id: "s15", name: "Olu", roles: ["bar", "kitchen"], maxShifts: 5 },
];

const fixtureRules: Rule[] = [
  { id: "r01", staffId: "s02", severity: "hard", kind: "unavailable", weekdays: [0, 6], source: "Ben does not work weekends" },
  { id: "r02", staffId: "s02", severity: "hard", kind: "unavailable", from: "2026-11-05", until: "2026-11-06" },
  { id: "r03", staffId: "s04", severity: "soft", kind: "unavailable", weekdays: [3], afterTime: "17:00" },
  { id: "r04", staffId: "s04", severity: "hard", kind: "min_rest", hours: 10 },
  { id: "r05", staffId: "s05", severity: "soft", kind: "max_shifts", max: 3 },
  { id: "r06", staffId: "s07", severity: "hard", kind: "no_double" },
  { id: "r07", staffId: "s08", severity: "hard", kind: "unavailable", until: "2026-11-03" },
  { id: "r08", staffId: "s09", severity: "hard", kind: "unavailable", beforeTime: "11:00" },
  { id: "r09", staffId: "s11", severity: "soft", kind: "min_rest", hours: 12 },
  { id: "r10", staffId: "s12", severity: "soft", kind: "unavailable", weekdays: [5, 6], afterTime: "22:00" },
  { id: "r11", staffId: "s13", severity: "hard", kind: "max_shifts", max: 4 },
  { id: "r12", staffId: "s14", severity: "hard", kind: "unavailable", from: "2026-11-06", until: "2026-11-08" },
  { id: "r13", staffId: "s15", severity: "soft", kind: "no_double" },
  { id: "r14", staffId: "s03", severity: "hard", kind: "min_rest", hours: 8 },
  { id: "r15", staffId: "s10", severity: "hard", kind: "unavailable", weekdays: [2] },
  { id: "r16", staffId: "s01", severity: "soft", kind: "max_shifts", max: 4 },
  { id: "r17", staffId: "s06", severity: "hard", kind: "unavailable", weekdays: [0], afterTime: "20:00" },
];

function buildFixtureSlots(): Slot[] {
  const slots: Slot[] = [];
  for (let d = 0; d < DAYS.length; d++) {
    const date = DAYS[d];
    slots.push({ id: `${date}-bar-close`, date, start: "17:00", end: "01:00", role: "bar", label: "Bar close" });
    slots.push({ id: `${date}-server-lunch-a`, date, start: "11:00", end: "16:00", role: "server" });
    slots.push({ id: `${date}-server-lunch-b`, date, start: "11:00", end: "16:00", role: "server" });
    slots.push({ id: `${date}-server-close`, date, start: "17:00", end: "22:30", role: "server" });
    slots.push({ id: `${date}-kitchen-open`, date, start: "10:00", end: "16:00", role: "kitchen" });
    slots.push({ id: `${date}-kitchen-close`, date, start: "16:00", end: "22:00", role: "kitchen" });
    if ([0, 2, 4, 5, 6].includes(d)) {
      slots.push({ id: `${date}-manager`, date, start: "09:00", end: "17:00", role: "manager" });
    }
  }
  return slots;
}

const fixture: SchedulingInput = { staff: fixtureStaff, slots: buildFixtureSlots(), rules: fixtureRules };

function shuffled<T>(xs: T[], shift: number): T[] {
  const out = [...xs].reverse();
  const k = shift % Math.max(1, out.length);
  return [...out.slice(k), ...out.slice(0, k)];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("realistic fixture", () => {
  const result = solveWeek({ ...fixture });

  it("fills every slot with no hard violation, per the independent checker", () => {
    expect(fixture.slots.length).toBe(47);
    expect(result.unfilled).toEqual([]);
    expect(result.assignments).toHaveLength(47);
    expect(independentProblems(fixture, result.assignments)).toEqual([]);
    expect(result.lockedViolations).toEqual([]);
  });

  it("gives every person at most their maxShifts and keeps fairness totals consistent", () => {
    const total = result.fairness.people.reduce((n, p) => n + p.shifts, 0);
    expect(total).toBe(47);
    for (const p of result.fairness.people) {
      const staff = fixtureStaff.find((s) => s.id === p.staffId)!;
      expect(p.shifts).toBeLessThanOrEqual(staff.maxShifts);
    }
  });

  it("trace closes statements equal a recount from the final assignments", () => {
    const slotById = new Map(fixture.slots.map((s) => [s.id, s] as const));
    for (const a of result.assignments) {
      const trace = result.traces[a.slotId];
      expect(trace.staffId).toBe(a.staffId);
      const claimed = /Has (\d+) closes this week/.exec(trace.reasons.join(" "));
      expect(claimed).not.toBeNull();
      const recount = result.assignments.filter(
        (x) => x.staffId === a.staffId && isCloseShift(slotById.get(x.slotId)!),
      ).length;
      expect(Number(claimed![1])).toBe(recount);
    }
  });
});

describe("determinism", () => {
  it("returns byte-identical JSON across shuffled input order and repeat runs", () => {
    const base = JSON.stringify(solveWeek({ ...fixture }));
    const shuffledInput: SchedulingInput = {
      staff: shuffled(fixture.staff, 4),
      slots: shuffled(fixture.slots, 17),
      rules: shuffled(fixture.rules, 9),
    };
    const shuffledRun = JSON.stringify(solveWeek(shuffledInput));
    expect(shuffledRun).toBe(base);
    expect(JSON.stringify(solveWeek({ ...fixture }))).toBe(base);
    expect(JSON.stringify(solveWeek({ ...fixture }))).toBe(base);
  });
});

describe("locked assignments", () => {
  it("keeps valid locked assignments exactly as given", () => {
    const locked: Assignment[] = [
      { slotId: "2026-11-04-bar-close", staffId: "s03", locked: true },
      { slotId: "2026-11-06-manager", staffId: "s01", locked: true },
    ];
    const result = solveWeek({ ...fixture, assignments: locked });
    for (const l of locked) {
      expect(result.assignments).toContainEqual({ slotId: l.slotId, staffId: l.staffId, locked: true });
    }
    expect(result.lockedViolations).toEqual([]);
    expect(independentProblems(fixture, result.assignments)).toEqual([]);
  });

  it("keeps a locked assignment that breaks a rule and flags it honestly", () => {
    const locked: Assignment[] = [
      { slotId: "2026-11-04-kitchen-open", staffId: "s07", locked: true },
      { slotId: "2026-11-04-kitchen-close", staffId: "s07", locked: true },
    ];
    const result = solveWeek({ ...fixture, assignments: locked });
    expect(result.assignments).toContainEqual({ slotId: "2026-11-04-kitchen-open", staffId: "s07", locked: true });
    expect(result.assignments).toContainEqual({ slotId: "2026-11-04-kitchen-close", staffId: "s07", locked: true });
    expect(result.lockedViolations.map((v) => v.slotId)).toEqual([
      "2026-11-04-kitchen-close",
      "2026-11-04-kitchen-open",
    ]);
    for (const v of result.lockedViolations) {
      expect(v.violations.map((x) => x.code)).toContain("no_double");
    }
    expect(result.traces["2026-11-04-kitchen-open"].reasons.join(" ")).toContain("Kept although it breaks a hard rule");
  });
});

describe("impossible case", () => {
  it("reports unfilled slots with true reasons, without violating rules or hanging", () => {
    const input: SchedulingInput = {
      staff: [{ id: "a", name: "Ada", roles: ["bar"], maxShifts: 5 }],
      slots: [
        { id: "x", date: "2026-11-04", start: "17:00", end: "23:00", role: "bar" },
        { id: "y", date: "2026-11-04", start: "20:00", end: "23:30", role: "bar" },
        { id: "z", date: "2026-11-04", start: "09:00", end: "12:00", role: "manager" },
      ],
      rules: [],
    };
    const result = solveWeek(input);
    expect(result.assignments).toHaveLength(1);
    expect(result.unfilled.map((u) => u.slotId)).toEqual(["y", "z"]);
    const y = result.unfilled.find((u) => u.slotId === "y")!;
    expect(y.reasons.join(" ")).toContain("Ada");
    expect(y.reasons.join(" ")).toContain("overlaps");
    const z = result.unfilled.find((u) => u.slotId === "z")!;
    expect(z.reasons).toEqual(["No one on the team has the manager role."]);
    expect(independentProblems(input, result.assignments)).toEqual([]);
  });
});

describe("repair", () => {
  it("changes few other assignments after a removal, and keeps locked unchanged", () => {
    const solved = solveWeek({ ...fixture });
    const previous: Assignment[] = solved.assignments.map((a) => ({ ...a }));
    // Lock one assignment that must survive the repair.
    const lockIdx = previous.findIndex((a) => a.staffId === "s01");
    previous[lockIdx] = { ...previous[lockIdx], locked: true };
    // Remove a person's assignment: a manager removes Dan from one shift.
    const removeIdx = previous.findIndex((a) => a.staffId === "s04" && !a.locked);
    const removed = previous[removeIdx];
    const afterRemoval = previous.filter((_, i) => i !== removeIdx);

    const repaired = repairWeek({ ...fixture }, afterRemoval);

    expect(repaired.assignments).toContainEqual(previous[lockIdx]);
    expect(repaired.unfilled).toEqual([]);
    const others = repaired.assignments.filter((a) => a.slotId !== removed.slotId);
    const changedOthers = afterRemoval.filter((p) => {
      const now = others.find((a) => a.slotId === p.slotId);
      return now === undefined || now.staffId !== p.staffId;
    });
    expect(changedOthers).toEqual([]);
    expect(repaired.moved).toHaveLength(0);
    expect(independentProblems(fixture, repaired.assignments)).toEqual([]);
  });
});

describe("findCover", () => {
  const coverInput: SchedulingInput = {
    staff: [
      { id: "ann", name: "Ann", roles: ["bar"], maxShifts: 5, hourlyRate: 10, overtimeAfterHours: 8 },
      { id: "bob", name: "Bob", roles: ["bar"], maxShifts: 5 },
      { id: "cy", name: "Cy", roles: ["bar"], maxShifts: 5 },
      { id: "dee", name: "Dee", roles: ["bar"], maxShifts: 5, hourlyRate: 10, overtimeAfterHours: 8 },
      { id: "eve", name: "Eve", roles: ["server"], maxShifts: 5 },
    ],
    slots: [
      { id: "cover", date: "2026-11-04", start: "17:00", end: "23:00", role: "bar" },
      { id: "dee-1", date: "2026-11-03", start: "08:00", end: "14:00", role: "bar" },
      { id: "dee-2", date: "2026-11-02", start: "08:00", end: "14:00", role: "bar" },
      { id: "cy-1", date: "2026-11-04", start: "18:00", end: "20:00", role: "bar" },
    ],
    rules: [
      { id: "c1", staffId: "bob", severity: "hard", kind: "unavailable", from: "2026-11-04", until: "2026-11-04" },
    ],
  };
  const assignments: Assignment[] = [
    { slotId: "dee-1", staffId: "dee", locked: false },
    { slotId: "dee-2", staffId: "dee", locked: false },
    { slotId: "cy-1", staffId: "cy", locked: false },
  ];

  it("excludes people who break a hard rule and ranks non-overtime first", () => {
    const options = findCover(coverInput, assignments, "cover");
    expect(options.map((o) => o.staffId)).toEqual(["ann", "dee"]);
    expect(options.every((o) => o.allowed === true)).toBe(true);
    expect(options[0].overtimeCost).toBe(0);
    expect(options[1].overtimeCost).toBeGreaterThan(0);
    expect(options[0].shiftsAfter).toBe(1);
    expect(options[1].shiftsAfter).toBe(3);
  });

  it("returns an empty list when nobody qualifies", () => {
    const noOne: SchedulingInput = { ...coverInput, staff: [coverInput.staff[4]], rules: [] };
    expect(findCover(noOne, [], "cover")).toEqual([]);
  });
});

describe("time boundaries", () => {
  const base: SchedulingInput = {
    staff: [{ id: "p", name: "Pat", roles: ["bar"], maxShifts: 9 }],
    slots: [],
    rules: [],
  };
  const withSlots = (slots: Slot[], rules: Rule[] = []): SchedulingInput => ({ ...base, slots, rules });

  it("treats an overnight shift as ending the next day", () => {
    const overnight: Slot = { id: "n", date: "2026-11-04", start: "22:00", end: "02:00", role: "bar" };
    const nextMorningOverlap: Slot = { id: "m1", date: "2026-11-05", start: "01:00", end: "06:00", role: "bar" };
    const nextMorningOk: Slot = { id: "m2", date: "2026-11-05", start: "02:00", end: "06:00", role: "bar" };
    const input = withSlots([overnight, nextMorningOverlap, nextMorningOk]);
    const existing: Assignment[] = [{ slotId: "n", staffId: "p", locked: true }];
    expect(checkAssignment(input, existing, { slotId: "m1", staffId: "p" }).ok).toBe(false);
    expect(checkAssignment(input, existing, { slotId: "m2", staffId: "p" }).ok).toBe(true);
  });

  it("blocks an afterTime rule when the shift starts exactly at that time", () => {
    const rule: Rule = { id: "u", staffId: "p", severity: "hard", kind: "unavailable", afterTime: "17:00", from: "2026-11-04", until: "2026-11-04" };
    const atStart: Slot = { id: "a", date: "2026-11-04", start: "17:00", end: "21:00", role: "bar" };
    const endsAtStart: Slot = { id: "b", date: "2026-11-04", start: "09:00", end: "17:00", role: "bar" };
    const input = withSlots([atStart, endsAtStart], [rule]);
    const res1 = checkAssignment(input, [], { slotId: "a", staffId: "p" });
    expect(res1.ok).toBe(false);
    expect(res1.violations[0].message).toBe("Pat can't work after 17:00 from Nov 4 until Nov 4.");
    expect(checkAssignment(input, [], { slotId: "b", staffId: "p" }).ok).toBe(true);
  });

  it("applies date range edges inclusively and leaves outside dates alone", () => {
    const rule: Rule = { id: "u", staffId: "p", severity: "hard", kind: "unavailable", from: "2026-11-04", until: "2026-11-06" };
    const slots: Slot[] = [
      { id: "d03", date: "2026-11-03", start: "09:00", end: "10:00", role: "bar" },
      { id: "d04", date: "2026-11-04", start: "09:00", end: "10:00", role: "bar" },
      { id: "d06", date: "2026-11-06", start: "09:00", end: "10:00", role: "bar" },
      { id: "d07", date: "2026-11-07", start: "09:00", end: "10:00", role: "bar" },
    ];
    const input = withSlots(slots, [rule]);
    expect(checkAssignment(input, [], { slotId: "d03", staffId: "p" }).ok).toBe(true);
    expect(checkAssignment(input, [], { slotId: "d04", staffId: "p" }).ok).toBe(false);
    expect(checkAssignment(input, [], { slotId: "d06", staffId: "p" }).ok).toBe(false);
    expect(checkAssignment(input, [], { slotId: "d07", staffId: "p" }).ok).toBe(true);
  });

  it("measures min_rest across midnight", () => {
    const rule: Rule = { id: "r", staffId: "p", severity: "hard", kind: "min_rest", hours: 10 };
    const late: Slot = { id: "late", date: "2026-11-04", start: "20:00", end: "00:00", role: "bar" };
    const tooSoon: Slot = { id: "soon", date: "2026-11-05", start: "06:00", end: "12:00", role: "bar" };
    const exactly: Slot = { id: "ok", date: "2026-11-05", start: "10:00", end: "14:00", role: "bar" };
    const input = withSlots([late, tooSoon, exactly], [rule]);
    const existing: Assignment[] = [{ slotId: "late", staffId: "p", locked: true }];
    const soonResult = checkAssignment(input, existing, { slotId: "soon", staffId: "p" });
    expect(soonResult.ok).toBe(false);
    expect(soonResult.violations[0].code).toBe("min_rest");
    expect(checkAssignment(input, existing, { slotId: "ok", staffId: "p" }).ok).toBe(true);
  });

  it("detects Saturday and Sunday from the date alone using Date.UTC", () => {
    const rule: Rule = { id: "w", staffId: "p", severity: "hard", kind: "unavailable", weekdays: [0, 6] };
    const sat: Slot = { id: "sat", date: "2026-11-07", start: "09:00", end: "10:00", role: "bar" };
    const sun: Slot = { id: "sun", date: "2026-11-08", start: "09:00", end: "10:00", role: "bar" };
    const mon: Slot = { id: "mon", date: "2026-11-02", start: "09:00", end: "10:00", role: "bar" };
    expect(new Date(Date.UTC(2026, 10, 7)).getUTCDay()).toBe(6);
    const input = withSlots([sat, sun, mon], [rule]);
    expect(checkAssignment(input, [], { slotId: "sat", staffId: "p" }).ok).toBe(false);
    expect(checkAssignment(input, [], { slotId: "sun", staffId: "p" }).ok).toBe(false);
    expect(checkAssignment(input, [], { slotId: "mon", staffId: "p" }).ok).toBe(true);
  });

  it("rejects a shift that overlaps a day-start unavailable window (beforeTime)", () => {
    const rule: Rule = { id: "b", staffId: "p", severity: "hard", kind: "unavailable", beforeTime: "11:00" };
    const early: Slot = { id: "e", date: "2026-11-04", start: "10:00", end: "12:00", role: "bar" };
    const late: Slot = { id: "l", date: "2026-11-04", start: "11:00", end: "12:00", role: "bar" };
    const input = withSlots([early, late], [rule]);
    expect(checkAssignment(input, [], { slotId: "e", staffId: "p" }).ok).toBe(false);
    expect(checkAssignment(input, [], { slotId: "l", staffId: "p" }).ok).toBe(true);
  });
});

describe("adversarial input", () => {
  const staff: Staff[] = [{ id: "a", name: "Ada", roles: ["bar"], maxShifts: 2 }];
  const slot: Slot = { id: "s1", date: "2026-11-04", start: "09:00", end: "10:00", role: "bar" };

  it("throws a clear error for an unknown staff id", () => {
    expect(() => solveWeek({ staff, slots: [slot], rules: [], assignments: [{ slotId: "s1", staffId: "ghost", locked: true }] })).toThrow(/Unknown staff id: ghost/);
    expect(() => checkAssignment({ staff, slots: [slot], rules: [] }, [], { slotId: "s1", staffId: "ghost" })).toThrow(/Unknown staff id/);
  });

  it("handles an empty staff list by leaving every slot unfilled", () => {
    const result = solveWeek({ staff: [], slots: [slot], rules: [] });
    expect(result.assignments).toEqual([]);
    expect(result.unfilled.map((u) => u.slotId)).toEqual(["s1"]);
  });

  it("handles an empty slot list", () => {
    const result = solveWeek({ staff, slots: [], rules: [] });
    expect(result.assignments).toEqual([]);
    expect(result.unfilled).toEqual([]);
  });

  it("throws a clear error for duplicate slot ids", () => {
    expect(() => solveWeek({ staff, slots: [slot, { ...slot }], rules: [] })).toThrow(/Duplicate slot id: s1/);
  });
});

describe("performance", () => {
  it("solves a 30-staff, 120-slot week in under 3 seconds with no hard violation", () => {
    const staff: Staff[] = [];
    for (let i = 0; i < 30; i++) {
      const roles = i % 3 === 0 ? ["bar"] : i % 3 === 1 ? ["server"] : ["kitchen"];
      if (i % 5 === 0) roles.push("manager");
      staff.push({ id: `p${String(i).padStart(2, "0")}`, name: `P${i}`, roles, maxShifts: 6 });
    }
    const slots: Slot[] = [];
    const roleCycle = ["bar", "server", "server", "kitchen", "kitchen"];
    for (let i = 0; i < 120; i++) {
      const date = DAYS[i % 7];
      const role = roleCycle[i % roleCycle.length];
      const start = i % 2 === 0 ? "11:00" : "17:00";
      const end = i % 2 === 0 ? "16:00" : "23:00";
      slots.push({ id: `slot-${String(i).padStart(3, "0")}`, date, start, end, role });
    }
    const rules: Rule[] = [];
    for (let i = 0; i < 30; i += 3) rules.push({ id: `mr${i}`, staffId: staff[i].id, severity: "hard", kind: "min_rest", hours: 10 });
    rules.push({ id: "wk", staffId: staff[1].id, severity: "soft", kind: "max_shifts", max: 3 });

    const input: SchedulingInput = { staff, slots, rules };
    const started = performance.now();
    const result = solveWeek(input);
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(3000);
    expect(independentProblems(input, result.assignments)).toEqual([]);
  });
});
