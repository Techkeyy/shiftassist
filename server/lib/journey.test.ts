import { getDbExec } from "@agent-native/core/db";
import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { checkAssignment } from "../../lib/solver/index";
import { getDb } from "../db/index.js";
import { migrations } from "../db/migrations.js";
import { assignments, rules, staff, weeks } from "../db/schema.js";
import { applyCover, buildWeek, loadSchedule, moveShift } from "./assignments.js";
import { explainShiftView, findCoverView } from "./insight.js";
import {
  getPublicWeek,
  publishWeek,
  renderPublicWeekHtml,
  unpublishWeek,
} from "./publish.js";
import { confirmRules, deleteRule, listRuleCards, proposeRules, saveRule } from "./rules.js";
import { writeSampleWeek } from "./sample.js";
import { saveSetup } from "./setup.js";
import { buildWeekView } from "./week-view.js";

const A = "alice@example.test";
const B = "bob@example.test";
const START = "2026-11-09"; // a Monday

const ALL_DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

async function setup(owner: string, names = ["Ann", "Bo", "Cy", "Di"]) {
  await saveSetup(owner, {
    weekStart: START,
    staff: names.map((n, i) => ({ name: n, roles: ["server"], maxShifts: 5, ...(i === 0 ? { hourlyRate: 4242, overtimeAfterHours: 10 } : {}) })),
    pattern: [{ name: "Dinner server", role: "server", start: "17:00", end: "23:00", days: [1, 2, 3, 4, 5, 6, 0], count: 1 }],
  });
  const view = await buildWeekView(owner);
  return {
    byName: (n: string) => view.staff.find((s) => s.name === n)!.id,
    slotOn: (date: string) => view.slots.find((s) => s.date === date)!.id,
  };
}

async function snapshot(owner: string) {
  const rows = await getDb().select().from(assignments).where(eq(assignments.ownerEmail, owner));
  return rows.map((r) => `${r.slotId}:${r.staffId}:${r.locked}`).sort().join("|");
}

async function ruleCount(owner: string) {
  return (await getDb().select().from(rules).where(eq(rules.ownerEmail, owner))).length;
}

beforeAll(async () => {
  const exec = getDbExec();
  for (const m of migrations) {
    const sql = typeof m.sql === "string" ? m.sql : (m.sql.postgres ?? "");
    for (const stmt of sql.split(";").map((x) => x.trim()).filter(Boolean)) await exec.execute(stmt);
  }
}, 60_000);

describe("proposed rules never reach the solver", () => {
  const owner = "proposed@example.test";
  it("loadSchedule returns only confirmed rules, and a proposed hard rule does not change the build", async () => {
    const ids = await setup(owner);
    const r = await proposeRules(owner, [
      { staffName: "Ann", kind: "unavailable", severity: "hard", days: [...ALL_DAYS], source: "Ann: I can never work" },
    ]);
    expect(r.stored).toBe(1);

    const loaded = await loadSchedule(getDb(), owner);
    expect(loaded.input.rules).toHaveLength(0);

    const built = await buildWeek(owner);
    expect(built.proposedRulesIgnored).toBe(1);
    const annShifts = (await buildWeekView(owner)).slots.filter((s) => s.staffId === ids.byName("Ann"));
    expect(annShifts.length).toBeGreaterThan(0);

    // Once the manager confirms it, the same rule is used and Ann gets nothing.
    const cards = await listRuleCards(owner);
    await confirmRules(owner, { ids: [cards[0]!.id] });
    expect((await loadSchedule(getDb(), owner)).input.rules).toHaveLength(1);
    await buildWeek(owner);
    expect((await buildWeekView(owner)).slots.filter((s) => s.staffId === ids.byName("Ann"))).toHaveLength(0);
  });

  it("moveShift and the week view treat a proposed rule as nonexistent for checks", async () => {
    const o = "proposed2@example.test";
    const ids = await setup(o);
    await proposeRules(o, [
      { staffName: "Bo", kind: "unavailable", severity: "hard", days: ["mon"], source: "Bo: no Mondays" },
    ]);
    const res = await moveShift(o, { slotId: ids.slotOn("2026-11-09"), staffId: ids.byName("Bo") });
    expect(res.changed).toBe(true);
  });
});

describe("propose-rules", () => {
  const owner = "propose@example.test";
  it("resolves names, keeps the source sentence, and flags unknown or ambiguous names instead of dropping them", async () => {
    await setup(owner, ["Maya Lee", "Maya Chen", "Sam"]);
    const r = await proposeRules(owner, [
      { staffName: "Sam", kind: "unavailable", severity: "hard", days: ["fri"], source: "Sam: no Fridays" },
      { staffName: "Carlos", kind: "unavailable", severity: "hard", days: ["mon"], source: "Carlos: only Mondays" },
      { staffName: "Maya", kind: "no_double", severity: "soft", source: "Maya: one shift a day please" },
      { staffName: "Sam", kind: "max_shifts", severity: "soft", source: "Sam: not too many" },
    ]);
    expect(r.stored).toBe(4);
    expect(r.flagged).toBe(3);
    const cards = await listRuleCards(owner);
    const sam = cards.find((c) => c.source === "Sam: no Fridays")!;
    expect(sam.staffName).toBe("Sam");
    expect(sam.status).toBe("proposed");
    expect(sam.flag).toBeNull();
    const carlos = cards.find((c) => c.source === "Carlos: only Mondays")!;
    expect(carlos.staffId).toBe("");
    expect(carlos.flag).toMatch(/isn't on your staff list/);
    const maya = cards.find((c) => c.source!.startsWith("Maya"))!;
    expect(maya.flag).toMatch(/Maya Lee or Maya Chen/);
    const unclear = cards.find((c) => c.source === "Sam: not too many")!;
    expect(unclear.kind).toBe("unclear");
    // Flagged cards can't be confirmed in bulk.
    const all = await confirmRules(owner, { all: true });
    expect(all.confirmed).toBe(1);
    expect(all.stillFlagged).toHaveLength(3);
  });
});

describe("messages that are not rules", () => {
  const owner = "notes@example.test";
  const SWAP = "Ana asked if she can swap with Tom on saturday";
  it("are stored as flagged note cards with their source, never reach the solver, and can be dismissed or turned into a rule", async () => {
    const ids = await setup(owner, ["Ana", "Tom", "Cy", "Di"]);
    const before = await buildWeek(owner);
    const filledBefore = before.filled;

    const r = await proposeRules(
      owner,
      [{ staffName: "Cy", kind: "unavailable", severity: "hard", days: ["fri"], source: "Cy: no Fridays" }],
      [{ source: SWAP, staffName: "Ana" }, { source: SWAP }],
    );
    // The same sentence twice is stored once.
    expect(r.stored).toBe(1);
    expect(r.notes).toBe(1);
    expect(r.duplicatesSkipped).toBe(1);

    const cards = await listRuleCards(owner);
    const note = cards.find((c) => c.kind === "note")!;
    expect(note.source).toBe(SWAP);
    expect(note.flag).toMatch(/not a rule/i);
    expect(note.status).toBe("proposed");
    expect(note.staffName).toBe("Ana");
    expect(note.text).toContain("swap with Tom");

    // Not a rule: the solver never sees it, whatever its status.
    expect((await loadSchedule(getDb(), owner)).input.rules).toHaveLength(0);
    // It cannot be confirmed, singly or in bulk, and it does not block the next step.
    await expect(confirmRules(owner, { ids: [note.id] })).rejects.toThrow(/note, not a rule/);
    const all = await confirmRules(owner, { all: true });
    expect(all.confirmed).toBe(1); // only Cy's real rule
    expect((await listRuleCards(owner)).find((c) => c.id === note.id)!.status).toBe("proposed");
    const view = await buildWeekView(owner);
    expect(view.nextStep).not.toBe("confirm");

    // A forced confirmation still does not reach the solver.
    await getDb().update(rules).set({ status: "confirmed" }).where(eq(rules.id, note.id));
    const loaded = await loadSchedule(getDb(), owner);
    expect(loaded.input.rules.map((x) => x.id)).not.toContain(note.id);
    await getDb().update(rules).set({ status: "proposed" }).where(eq(rules.id, note.id));
    const rebuilt = await buildWeek(owner);
    expect(rebuilt.proposedRulesIgnored).toBe(0);
    expect(rebuilt.filled).toBeGreaterThanOrEqual(filledBefore - 1);

    // The manager turns it into a real rule: same card, now a confirmed rule.
    const saved = await saveRule(owner, { id: note.id, staffId: ids.byName("Tom"), kind: "unavailable", severity: "soft", days: ["sat"], source: SWAP });
    expect(saved.text).toMatch(/Tom/);
    const turned = (await listRuleCards(owner)).find((c) => c.id === note.id)!;
    expect(turned.kind).toBe("unavailable");
    expect(turned.status).toBe("confirmed");
    expect(turned.flag).toBeNull();

    // A second note can simply be dismissed.
    await proposeRules(owner, [], [{ source: "Tom says thanks for the cover" }]);
    const other = (await listRuleCards(owner)).find((c) => c.kind === "note")!;
    await deleteRule(owner, other.id);
    expect((await listRuleCards(owner)).some((c) => c.kind === "note")).toBe(false);
  });
});

describe("build-week", () => {
  const owner = "build@example.test";
  it("keeps locked shifts and never breaks a confirmed hard rule", async () => {
    const ids = await setup(owner);
    await saveRule(owner, { staffId: ids.byName("Ann"), kind: "unavailable", severity: "hard", days: ["mon", "tue"], source: "Ann: no Mon or Tue" });
    await saveRule(owner, { staffId: ids.byName("Bo"), kind: "unavailable", severity: "hard", days: ["sat"], source: "Bo: no Saturday" });
    await buildWeek(owner);
    // Lock Cy onto Wednesday, then rebuild.
    const wed = ids.slotOn("2026-11-11");
    await moveShift(owner, { slotId: wed, staffId: ids.byName("Cy"), lock: true });
    const second = await buildWeek(owner);
    expect(second.lockedKept).toBe(1);

    const { input, assignments: placed } = await loadSchedule(getDb(), owner);
    const lockedRow = placed.find((a) => a.slotId === wed)!;
    expect(lockedRow.staffId).toBe(ids.byName("Cy"));
    expect(lockedRow.locked).toBe(true);
    for (const a of placed) {
      const others = placed.filter((x) => x.slotId !== a.slotId);
      const check = checkAssignment(input, others, { slotId: a.slotId, staffId: a.staffId });
      expect(check.ok, `${a.slotId} -> ${a.staffId}: ${check.violations.map((v) => v.message).join(" ")}`).toBe(true);
    }
    const names = new Map(input.staff.map((s) => [s.id, s.name]));
    const day = (date: string) => placed.find((a) => input.slots.find((s) => s.id === a.slotId)!.date === date);
    expect(names.get(day("2026-11-09")!.staffId)).not.toBe("Ann");
    expect(names.get(day("2026-11-14")!.staffId)).not.toBe("Bo");
  });

  it("reports true reasons for a shift it cannot fill", async () => {
    const o = "build2@example.test";
    const ids = await setup(o, ["Ann"]);
    await saveRule(o, { staffId: ids.byName("Ann"), kind: "unavailable", severity: "hard", days: ["mon"], source: "Ann: no Monday" });
    const r = await buildWeek(o);
    expect(r.unfilled.length).toBeGreaterThan(0);
    const mon = r.unfilled.find((u) => u.description.includes("Mon 9 Nov"))!;
    expect(mon.reasons.join(" ")).toMatch(/Ann can't work on Mon/);
    expect(r.fairness.find((p) => p.name === "Ann")).toBeDefined();
  });
});

describe("locked shifts", () => {
  const owner = "locked@example.test";
  it("refuses to give a locked shift to someone else, for any caller of moveShift", async () => {
    const ids = await setup(owner);
    await buildWeek(owner);
    const slot = ids.slotOn("2026-11-10");
    const holder = (await buildWeekView(owner)).slots.find((s) => s.id === slot)!.staffId!;
    await moveShift(owner, { slotId: slot, staffId: holder, lock: true });
    const other = ["Ann", "Bo", "Cy", "Di"].map(ids.byName).find((id) => id !== holder)!;
    const before = await snapshot(owner);
    await expect(moveShift(owner, { slotId: slot, staffId: other })).rejects.toThrow("This shift is locked. Unlock it first.");
    await expect(moveShift(owner, { slotId: slot, staffId: other, lock: false })).rejects.toThrow("This shift is locked. Unlock it first.");
    expect(await snapshot(owner)).toBe(before);
    // Unlock first, then it moves.
    await moveShift(owner, { slotId: slot, staffId: holder, lock: false });
    const moved = await moveShift(owner, { slotId: slot, staffId: other });
    expect(moved.changed).toBe(true);
  });

  it("records what changed so the board can highlight it", async () => {
    const o = "locked2@example.test";
    const ids = await setup(o);
    await buildWeek(o);
    const slot = ids.slotOn("2026-11-12");
    const holder = (await buildWeekView(o)).slots.find((s) => s.id === slot)!.staffId!;
    const other = ["Ann", "Bo", "Cy", "Di"].map(ids.byName).find((id) => id !== holder)!;
    const r = await moveShift(o, { slotId: slot, staffId: other });
    const view = await buildWeekView(o);
    expect(view.lastChange?.kind).toBe("move");
    expect(view.lastChange?.slotIds).toEqual([slot, ...r.repaired.map((x) => x.slotId)]);
  });
});

describe("apply-cover", () => {
  const owner = "cover@example.test";
  it("covers the shift through the rules, marks the absent person off, and prepares a message", async () => {
    const ids = await setup(owner);
    await buildWeek(owner);
    const date = "2026-11-12";
    const slot = ids.slotOn(date);
    const holder = (await buildWeekView(owner)).slots.find((s) => s.id === slot)!.staffId!;
    const cover = await findCoverView(owner, slot);
    expect(cover.options.length).toBeGreaterThan(0);
    expect(cover.options.some((o) => o.staffId === holder)).toBe(false);
    const pick = cover.options[0]!;
    const res = await applyCover(owner, { slotId: slot, coverStaffId: pick.staffId });
    expect(res.coverStaffId).toBe(pick.staffId);
    expect(res.offRuleAdded).toBe(true);
    expect(res.message).toContain(pick.name);
    expect(res.message).not.toMatch(/\bsent\b/i);

    const view = await buildWeekView(owner);
    expect(view.slots.find((s) => s.id === slot)!.staffId).toBe(pick.staffId);
    const off = view.rules.find((r) => r.staffId === holder && r.status === "confirmed" && r.kind === "unavailable" && (r.details as { from?: string }).from === date);
    expect(off).toBeDefined();
    expect(off!.source).toMatch(/can't make it/);

    // A rebuild never puts the absent person back on that day.
    await buildWeek(owner);
    const after = (await buildWeekView(owner)).slots.find((s) => s.id === slot)!;
    expect(after.staffId).not.toBe(holder);
  });

  it("refuses a cover who would break a hard rule and changes nothing", async () => {
    const o = "cover2@example.test";
    const ids = await setup(o);
    await buildWeek(o);
    const slot = ids.slotOn("2026-11-13");
    const holder = (await buildWeekView(o)).slots.find((s) => s.id === slot)!.staffId!;
    const blocked = ["Ann", "Bo", "Cy", "Di"].map(ids.byName).find((id) => id !== holder)!;
    await saveRule(o, { staffId: blocked, kind: "unavailable", severity: "hard", from: "2026-11-13", until: "2026-11-13", source: "test: off Friday" });
    const rulesBefore = await ruleCount(o);
    const before = await snapshot(o);
    await expect(applyCover(o, { slotId: slot, coverStaffId: blocked })).rejects.toThrow(/Not allowed/);
    expect(await snapshot(o)).toBe(before);
    expect(await ruleCount(o)).toBe(rulesBefore);
  });

  it("with nobody available it says why, leaves the shift open and still marks the person off", async () => {
    const o = "cover3@example.test";
    const ids = await setup(o, ["Ann", "Bo"]);
    await buildWeek(o);
    const slot = ids.slotOn("2026-11-14");
    const holder = (await buildWeekView(o)).slots.find((s) => s.id === slot)!.staffId!;
    const otherId = [ids.byName("Ann"), ids.byName("Bo")].find((id) => id !== holder)!;
    await saveRule(o, { staffId: otherId, kind: "unavailable", severity: "hard", days: ["sat"], source: "test: no Saturday" });
    const cover = await findCoverView(o, slot);
    expect(cover.options).toHaveLength(0);
    expect(cover.blocked.find((b) => b.staffId === otherId)!.blockedBy.join(" ")).toMatch(/can't work/);
    const res = await applyCover(o, { slotId: slot });
    expect(res.leftOpen).toBe(true);
    expect(res.message).toBeNull();
    const view = await buildWeekView(o);
    expect(view.slots.find((s) => s.id === slot)!.staffId).toBeNull();
  });

  it("explain-shift gives engine reasons and who else could have had it", async () => {
    const o = "explain@example.test";
    const ids = await setup(o);
    await buildWeek(o);
    const ex = await explainShiftView(o, ids.slotOn("2026-11-10"));
    expect(ex.reasons.join(" ")).toMatch(/Has the server role/);
    expect(ex.others).toHaveLength(3);
    // The current holder standing on the shift must not be given as the reason others "can't".
    for (const o of ex.others) expect(o.blockedBy.join(" ")).not.toMatch(/already filled by/);
  });
});

describe("publish", () => {
  const owner = "publish@example.test";
  it("exposes only names, shifts and reasons; revoked and malformed tokens fail", async () => {
    await setup(owner);
    await buildWeek(owner);
    const pub = await publishWeek(owner);
    expect(pub.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pub.path).toBe(`/s/${pub.token}`);
    expect((await publishWeek(owner)).token).toBe(pub.token);

    const week = await getPublicWeek(pub.token!);
    expect(week).not.toBeNull();
    expect(week!.days).toHaveLength(7);
    expect(week!.people.length).toBeGreaterThan(0);
    const json = JSON.stringify(week);
    const html = renderPublicWeekHtml(week!);
    for (const text of [json, html]) {
      expect(text).not.toContain("@");
      expect(text).not.toContain("4242"); // Ann's hourly rate
      expect(text).not.toMatch(/ownerEmail|owner_email|hourlyRate|staffId|st001/);
    }
    expect(Object.keys(week!).sort()).toEqual(["days", "isSample", "name", "people", "publishedAt", "startDate"]);

    expect(await getPublicWeek("not-a-token")).toBeNull();
    expect(await getPublicWeek("A".repeat(43))).toBeNull();

    // The page follows the current state.
    const ids = (await buildWeekView(owner)).staff;
    const slot = (await buildWeekView(owner)).slots[0]!;
    const other = ids.find((s) => s.id !== slot.staffId)!;
    await moveShift(owner, { slotId: slot.id, staffId: other.id });
    const again = await getPublicWeek(pub.token!);
    expect(again!.days[0]!.shifts[0]!.person).toBe(other.name);

    await unpublishWeek(owner);
    expect(await getPublicWeek(pub.token!)).toBeNull();
    const re = await publishWeek(owner);
    expect(re.token).not.toBe(pub.token);
  });

  it("labels the sample and escapes names", async () => {
    const o = "publish-sample@example.test";
    await writeSampleWeek(o, { replace: true, today: new Date("2026-11-09T12:00:00Z") });
    const pub = await publishWeek(o);
    const html = renderPublicWeekHtml((await getPublicWeek(pub.token!))!);
    expect(html).toContain("SAMPLE");
    const evil = renderPublicWeekHtml({
      name: "<script>x</script>",
      isSample: false,
      startDate: "2026-11-09",
      publishedAt: null,
      days: [],
      people: [{ name: "<img onerror=1>", shifts: [] }],
    });
    expect(evil).not.toContain("<script>x");
    expect(evil).not.toContain("<img onerror");
  });
});

describe("another owner can read and write none of it", () => {
  it("is refused on every path", async () => {
    const ids = await setup(A);
    await buildWeek(A);
    await setup(B, ["Zed", "Yan"]);
    await buildWeek(B);
    const prop = await proposeRules(A, [{ staffName: "Ann", kind: "no_double", severity: "hard", source: "Ann: one a day" }]);
    const ruleId = prop.cards[0]!.id;
    const slotA = ids.slotOn("2026-11-10");
    const before = await snapshot(A);
    const rulesBefore = await ruleCount(A);

    await expect(moveShift(B, { slotId: slotA, staffId: ids.byName("Ann") })).rejects.toThrow();
    await expect(explainShiftView(B, slotA)).rejects.toThrow(/doesn't exist/);
    await expect(findCoverView(B, slotA)).rejects.toThrow(/doesn't exist/);
    await expect(applyCover(B, { slotId: slotA })).rejects.toThrow(/doesn't exist/);
    await expect(deleteRule(B, ruleId)).rejects.toThrow(/doesn't exist/);
    const conf = await confirmRules(B, { ids: [ruleId] });
    expect(conf.confirmed).toBe(0);
    await expect(saveRule(B, { id: ruleId, staffId: ids.byName("Ann"), kind: "no_double", severity: "hard" })).rejects.toThrow();

    expect(await snapshot(A)).toBe(before);
    expect(await ruleCount(A)).toBe(rulesBefore);
    expect((await listRuleCards(A)).find((r) => r.id === ruleId)!.status).toBe("proposed");

    // B's own reads never contain A's people.
    const bView = await buildWeekView(B);
    expect(bView.staff.map((s) => s.name).sort()).toEqual(["Yan", "Zed"]);
    expect(bView.rules.find((r) => r.id === ruleId)).toBeUndefined();

    // B's published link shows B's data only; stopping B's link does not touch A's.
    const pa = await publishWeek(A);
    const pb = await publishWeek(B);
    expect(pa.token).not.toBe(pb.token);
    const pubB = JSON.stringify(await getPublicWeek(pb.token!));
    expect(pubB).not.toContain("Ann");
    await unpublishWeek(B);
    expect(await getPublicWeek(pa.token!)).not.toBeNull();
    const [wa] = await getDb().select().from(weeks).where(and(eq(weeks.ownerEmail, A)));
    expect(wa!.publishedToken).toBe(pa.token);
    const stA = await getDb().select().from(staff).where(eq(staff.ownerEmail, A));
    expect(stA).toHaveLength(4);
  });
});

describe("setup", () => {
  it("replacing the sample needs confirmation, and editing keeps people and rules", async () => {
    const o = "setup@example.test";
    await writeSampleWeek(o, { replace: true, today: new Date("2026-11-09T12:00:00Z") });
    const input = {
      weekStart: START,
      staff: [{ name: "Una", roles: ["server"], maxShifts: 5 }],
      pattern: [{ name: "Dinner", role: "server", start: "17:00", end: "23:00", days: [1, 2], count: 1 }],
    };
    await expect(saveSetup(o, input)).rejects.toThrow(/Confirm/);
    expect((await buildWeekView(o)).week!.isSample).toBe(true);
    const r = await saveSetup(o, { ...input, confirmReplace: true });
    expect(r.created).toBe(true);
    expect((await buildWeekView(o)).week!.isSample).toBe(false);
    expect((await buildWeekView(o)).staff.map((s) => s.name)).toEqual(["Una"]);

    // Edit: add a person, keep Una (and her rule); same shifts so nothing is cleared.
    let view = await buildWeekView(o);
    const una = view.staff[0]!;
    await saveRule(o, { staffId: una.id, kind: "no_double", severity: "hard", source: "Una: one a day" });
    await buildWeek(o);
    const edited = await saveSetup(o, { ...input, staff: [{ id: una.id, name: "Una", roles: ["server"], maxShifts: 5 }, { name: "Vic", roles: ["server"], maxShifts: 5 }] });
    expect(edited.created).toBe(false);
    expect(edited.rulesKept).toBe(1);
    expect(edited.assignmentsCleared).toBe(0);
    view = await buildWeekView(o);
    expect(view.staff).toHaveLength(2);
    expect(view.slots.filter((s) => s.staffId)).toHaveLength(2);
    // Changing the shifts clears the schedule only after confirmation.
    const changed = { ...input, staff: [{ id: una.id, name: "Una", roles: ["server"], maxShifts: 5 }], pattern: [{ ...input.pattern[0]!, days: [1, 2, 3] }] };
    await expect(saveSetup(o, changed)).rejects.toThrow(/Confirm/);
    expect((await buildWeekView(o)).slots.filter((s) => s.staffId)).toHaveLength(2);
    await saveSetup(o, { ...changed, confirmReplace: true });
    expect((await buildWeekView(o)).slots).toHaveLength(3);
  });
});

describe("role normalisation", () => {
  const one = (role: string) => ({ name: "Dinner", role, start: "17:00", end: "23:00", days: [1, 2], count: 1 });

  it("stores trimmed, lower case roles, so 'Server ' on staff matches 'server' on a shift", async () => {
    const o = "roles1@example.test";
    const r = await saveSetup(o, { weekStart: START, staff: [{ name: "Una", roles: ["Server "], maxShifts: 5 }], pattern: [one("server")] });
    expect(r.created).toBe(true);
    const [row] = await getDb().select().from(staff).where(eq(staff.ownerEmail, o));
    expect(JSON.parse(row!.roles)).toEqual(["server"]);
    await buildWeek(o);
    expect((await buildWeekView(o)).slots.every((s) => s.staffId)).toBe(true);
    // Messy spacing, case and a comma list on staff all normalise.
    const o2 = "roles2@example.test";
    await saveSetup(o2, { weekStart: START, staff: [{ name: "Una", roles: ["  Kitchen   Porter, COOK"], maxShifts: 5 }], pattern: [one("Kitchen  porter ")] });
    const [row2] = await getDb().select().from(staff).where(eq(staff.ownerEmail, o2));
    expect(JSON.parse(row2!.roles)).toEqual(["kitchen porter", "cook"]);
  });

  it("refuses a shift whose role nobody on the team has", async () => {
    const o = "roles3@example.test";
    await expect(
      saveSetup(o, { weekStart: START, staff: [{ name: "Una", roles: ["cook"], maxShifts: 5 }], pattern: [one("cook, server")] }),
    ).rejects.toThrow(/nobody on your team has that job/);
    expect((await buildWeekView(o)).hasWeek).toBe(false);
  });

  it("normalises roles already stored by older saves when loading", async () => {
    const o = "roles4@example.test";
    await saveSetup(o, { weekStart: START, staff: [{ name: "Una", roles: ["server"], maxShifts: 5 }], pattern: [one("server")] });
    await getDb().update(staff).set({ roles: JSON.stringify(["Server "]) }).where(eq(staff.ownerEmail, o));
    const { input } = await loadSchedule(getDb(), o);
    expect(input.staff[0]!.roles).toEqual(["server"]);
    await buildWeek(o);
    expect((await buildWeekView(o)).slots.every((s) => s.staffId)).toBe(true);
  });
});
