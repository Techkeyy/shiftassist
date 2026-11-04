import { getDbExec } from "@agent-native/core/db";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { getDb } from "../db/index.js";
import { migrations } from "../db/migrations.js";
import { assignments, slots, staff } from "../db/schema.js";
import { moveShift } from "./assignments.js";
import { writeSampleWeek } from "./sample.js";
import { buildWeekView } from "./week-view.js";

const A = "alice@example.test";
const B = "bob@example.test";
// Monday 2026-11-09 so weekday rules are predictable.
const TODAY = new Date("2026-11-09T12:00:00Z");

async function ids(owner: string) {
  const db = getDb();
  const st = await db.select().from(staff).where(eq(staff.ownerEmail, owner));
  const sl = await db.select().from(slots).where(eq(slots.ownerEmail, owner));
  const byName = (n: string) => st.find((s) => s.name === n)!.id;
  const slotAt = (date: string, label: string, nth = 0) =>
    sl.filter((s) => s.date === date && s.label === label).sort((a, b) => a.id.localeCompare(b.id))[nth]!.id;
  return { byName, slotAt };
}

async function snapshot(owner: string) {
  const rows = await getDb().select().from(assignments).where(eq(assignments.ownerEmail, owner));
  return rows
    .map((r) => `${r.slotId}:${r.staffId}:${r.locked}`)
    .sort()
    .join("|");
}

beforeAll(async () => {
  const exec = getDbExec();
  for (const m of migrations) {
    const sql = typeof m.sql === "string" ? m.sql : (m.sql.postgres ?? "");
    for (const stmt of sql.split(";").map((x) => x.trim()).filter(Boolean)) await exec.execute(stmt);
  }
  await writeSampleWeek(A, { replace: true, today: TODAY });
  await writeSampleWeek(B, { replace: true, today: TODAY });
});

describe("moveShift", () => {
  it("applies a valid move and persists it", async () => {
    const { byName, slotAt } = await ids(A);
    // Friday 2026-11-13 dinner server #0 -> Tom (a server with room).
    const slot = slotAt("2026-11-13", "Dinner server", 0);
    const before = await buildWeekView(A);
    const holder = before.slots.find((s) => s.id === slot)!.staffId;
    // Pick someone other than the holder who can legally take it.
    const candidates = ["Tom", "Sam", "Jo", "Priya", "Luis", "Ana"];
    let moved = null;
    for (const name of candidates) {
      if (byName(name) === holder) continue;
      try {
        moved = await moveShift(A, { slotId: slot, staffId: byName(name) });
        break;
      } catch {
        /* rule refused this candidate; try the next */
      }
    }
    expect(moved).not.toBeNull();
    expect(moved!.changed).toBe(true);
    const after = await buildWeekView(A);
    expect(after.slots.find((s) => s.id === slot)!.staffId).toBe(moved!.staffId);
  });

  it("refuses a rule-breaking move and leaves the database unchanged", async () => {
    const { byName, slotAt } = await ids(A);
    const fridayCook = slotAt("2026-11-13", "Dinner cook");
    const before = await snapshot(A);
    await expect(moveShift(A, { slotId: fridayCook, staffId: byName("Maya") })).rejects.toThrow(
      /Maya can't work on Fri/,
    );
    expect(await snapshot(A)).toBe(before);
  });

  it("is idempotent: repeating the same move changes nothing", async () => {
    const { byName, slotAt } = await ids(A);
    const slot = slotAt("2026-11-10", "Lunch server");
    const holder = (await buildWeekView(A)).slots.find((s) => s.id === slot)!.staffId!;
    const before = await snapshot(A);
    const r = await moveShift(A, { slotId: slot, staffId: holder });
    expect(r.changed).toBe(false);
    expect(await snapshot(A)).toBe(before);
    void byName;
  });

  it("refuses another owner's slot and leaves both owners untouched", async () => {
    const mine = await ids(A);
    const theirs = await ids(B);
    const beforeA = await snapshot(A);
    const beforeB = await snapshot(B);
    // A tries to move B's slot onto A's own person.
    await expect(
      moveShift(A, { slotId: theirs.slotAt("2026-11-13", "Dinner cook"), staffId: mine.byName("Luis") }),
    ).rejects.toThrow(/doesn't exist in your week/);
    // A tries to put B's person onto A's slot.
    await expect(
      moveShift(A, { slotId: mine.slotAt("2026-11-13", "Dinner cook"), staffId: theirs.byName("Luis") }),
    ).rejects.toThrow(/isn't on your staff list/);
    expect(await snapshot(A)).toBe(beforeA);
    expect(await snapshot(B)).toBe(beforeB);
  });

  it("refuses when the owner has no week", async () => {
    await expect(moveShift("nobody@example.test", { slotId: "x", staffId: "y" })).rejects.toThrow(
      /no week yet/,
    );
  });

  it("locks a shift without changing who holds it", async () => {
    const { slotAt } = await ids(A);
    const slot = slotAt("2026-11-11", "Dinner cook");
    const holder = (await buildWeekView(A)).slots.find((s) => s.id === slot)!.staffId!;
    const r = await moveShift(A, { slotId: slot, staffId: holder, lock: true });
    expect(r.changed).toBe(true);
    expect(r.locked).toBe(true);
    expect((await buildWeekView(A)).slots.find((s) => s.id === slot)!.locked).toBe(true);
  });
});
