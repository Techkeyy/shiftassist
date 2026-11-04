import { eq } from "drizzle-orm";

import { solveWeek, type Rule, type Slot, type Staff } from "../../lib/solver/index";
import { getDb } from "../db/index.js";
import { assignments, rules, slots, staff, weeks } from "../db/schema.js";

export const SAMPLE_WEEK_NAME = "SAMPLE: The Corner Table (not your data)";

/** The Monday on or after `from` (UTC), as YYYY-MM-DD. */
export function nextMonday(from: Date): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const add = (8 - d.getUTCDay()) % 7;
  d.setUTCDate(d.getUTCDate() + add);
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Ids sort in creation order (the solver breaks ties by id) and carry a random suffix so
 * they never collide with another account's rows (ids are global primary keys).
 */
function idMaker(prefix: string) {
  const nonce = crypto.randomUUID().slice(0, 8);
  let n = 0;
  return () => `${prefix}${String(++n).padStart(3, "0")}_${nonce}`;
}

export interface LoadSampleResult {
  loaded: boolean;
  replaced: boolean;
  weekName: string;
  startDate: string;
  staffCount: number;
  slotCount: number;
  assignedCount: number;
  unfilledCount: number;
}

/** Writes a labelled sample restaurant for `owner`. Caller decides whether replacing is allowed. */
export async function writeSampleWeek(
  owner: string,
  opts: { replace: boolean; today?: Date },
): Promise<LoadSampleResult> {
  const startDate = nextMonday(opts.today ?? new Date());
  const staffId = idMaker("st");
  const slotId = idMaker("sl");
  const ruleId = idMaker("ru");

  const mk = (name: string, roles: string[], maxShifts: number): Staff => ({
    id: staffId(),
    name,
    roles,
    maxShifts,
  });
  const maya = mk("Maya", ["cook", "server"], 5);
  const dev = mk("Dev", ["cook"], 5);
  const sam = mk("Sam", ["server"], 5);
  const priya = mk("Priya", ["server"], 4);
  const luis = mk("Luis", ["cook", "server"], 5);
  const jo = mk("Jo", ["server"], 5);
  const ana = mk("Ana", ["server", "cook"], 5);
  const tom = mk("Tom", ["server"], 5);
  const staffList = [maya, dev, sam, priya, luis, jo, ana, tom];

  const slotList: Slot[] = [];
  for (let day = 0; day < 7; day++) {
    const date = addDays(startDate, day);
    const add = (start: string, end: string, role: string, label: string, count = 1) => {
      for (let i = 0; i < count; i++) {
        slotList.push({ id: slotId(), date, start, end, role, label });
      }
    };
    add("10:00", "16:00", "cook", "Lunch cook");
    add("16:00", "23:00", "cook", "Dinner cook");
    add("11:00", "16:00", "server", "Lunch server");
    add("17:00", "23:00", "server", "Dinner server", 2);
  }

  const rule = (r: Omit<Rule, "id">): Rule => ({ id: ruleId(), ...r }) as Rule;
  const ruleList: Rule[] = [
    rule({ staffId: maya.id, severity: "hard", kind: "unavailable", weekdays: [5], source: "Maya: no Fridays (school pickup)" } as Rule),
    rule({ staffId: dev.id, severity: "hard", kind: "unavailable", weekdays: [0], source: "Dev: not Sundays" } as Rule),
    rule({ staffId: sam.id, severity: "hard", kind: "no_double", source: "Sam: one shift a day" } as Rule),
    rule({ staffId: priya.id, severity: "hard", kind: "unavailable", weekdays: [2, 4], afterTime: "17:00", source: "Priya: evening class Tue and Thu" } as Rule),
    rule({ staffId: jo.id, severity: "hard", kind: "min_rest", hours: 10, source: "Jo: 10 hours rest between shifts" } as Rule),
    rule({ staffId: luis.id, severity: "soft", kind: "unavailable", weekdays: [0], source: "Luis: prefers Sundays off" } as Rule),
  ];

  const solved = solveWeek({ staff: staffList, slots: slotList, rules: ruleList });

  const db = getDb();
  await db.transaction(async (tx) => {
    if (opts.replace) {
      await tx.delete(assignments).where(eq(assignments.ownerEmail, owner));
      await tx.delete(rules).where(eq(rules.ownerEmail, owner));
      await tx.delete(slots).where(eq(slots.ownerEmail, owner));
      await tx.delete(staff).where(eq(staff.ownerEmail, owner));
      await tx.delete(weeks).where(eq(weeks.ownerEmail, owner));
    }
    await tx.insert(weeks).values({
      id: crypto.randomUUID(),
      ownerEmail: owner,
      name: SAMPLE_WEEK_NAME,
      startDate,
      isSample: true,
      createdAt: new Date().toISOString(),
    });
    await tx.insert(staff).values(
      staffList.map((s) => ({
        id: s.id,
        ownerEmail: owner,
        name: s.name,
        roles: JSON.stringify(s.roles),
        maxShifts: s.maxShifts,
      })),
    );
    await tx.insert(slots).values(
      slotList.map((s) => ({
        id: s.id,
        ownerEmail: owner,
        date: s.date,
        start: s.start,
        end: s.end,
        role: s.role,
        label: s.label ?? null,
      })),
    );
    await tx.insert(rules).values(
      ruleList.map((r) => {
        const { id, staffId: sid, severity, kind, source, ...details } = r as Rule & Record<string, unknown>;
        return {
          id,
          ownerEmail: owner,
          staffId: sid,
          severity,
          kind,
          details: JSON.stringify(details),
          source: source ?? null,
        };
      }),
    );
    if (solved.assignments.length) {
      await tx.insert(assignments).values(
        solved.assignments.map((a) => ({
          id: crypto.randomUUID(),
          ownerEmail: owner,
          slotId: a.slotId,
          staffId: a.staffId,
          locked: false,
        })),
      );
    }
  });

  return {
    loaded: true,
    replaced: opts.replace,
    weekName: SAMPLE_WEEK_NAME,
    startDate,
    staffCount: staffList.length,
    slotCount: slotList.length,
    assignedCount: solved.assignments.length,
    unfilledCount: solved.unfilled.length,
  };
}

/** True when the owner has any week data at all. */
export async function ownerHasData(owner: string): Promise<boolean> {
  const db = getDb();
  const [w] = await db.select({ id: weeks.id }).from(weeks).where(eq(weeks.ownerEmail, owner));
  if (w) return true;
  const [s] = await db.select({ id: staff.id }).from(staff).where(eq(staff.ownerEmail, owner));
  return Boolean(s);
}
