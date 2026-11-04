import { getDbExec } from "@agent-native/core/db";
import { beforeAll, describe, expect, it } from "vitest";

import { migrations } from "../db/migrations.js";
import { consumeAgentTurn, DEFAULT_DAILY_AGENT_TURNS, dailyAgentTurnLimit, utcDay } from "./usage.js";

beforeAll(async () => {
  const exec = getDbExec();
  for (const m of migrations) {
    const sql = typeof m.sql === "string" ? m.sql : (m.sql.postgres ?? "");
    for (const stmt of sql.split(";").map((x) => x.trim()).filter(Boolean)) await exec.execute(stmt);
  }
}, 60_000);

describe("daily assistant turn limit", () => {
  it("defaults to 40 and reads SHIFTASSIST_DAILY_AGENT_TURNS", () => {
    expect(DEFAULT_DAILY_AGENT_TURNS).toBe(40);
    expect(dailyAgentTurnLimit({})).toBe(40);
    expect(dailyAgentTurnLimit({ SHIFTASSIST_DAILY_AGENT_TURNS: "3" })).toBe(3);
    expect(dailyAgentTurnLimit({ SHIFTASSIST_DAILY_AGENT_TURNS: "0" })).toBe(0);
    expect(dailyAgentTurnLimit({ SHIFTASSIST_DAILY_AGENT_TURNS: "lots" })).toBe(40);
  });

  it("allows exactly the limit, then refuses", async () => {
    const owner = "limit@example.test";
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await consumeAgentTurn(owner, 3)).allowed);
    expect(results).toEqual([true, true, true, false, false]);
  });

  it("counts each account on its own", async () => {
    expect((await consumeAgentTurn("a-own@example.test", 1)).allowed).toBe(true);
    expect((await consumeAgentTurn("a-own@example.test", 1)).allowed).toBe(false);
    expect((await consumeAgentTurn("b-own@example.test", 1)).allowed).toBe(true);
  });

  it("starts fresh on the next UTC day", async () => {
    const owner = "days@example.test";
    const d1 = new Date("2026-11-04T23:59:00Z");
    const d2 = new Date("2026-11-05T00:01:00Z");
    expect(utcDay(d1)).not.toBe(utcDay(d2));
    expect((await consumeAgentTurn(owner, 1, d1)).allowed).toBe(true);
    expect((await consumeAgentTurn(owner, 1, d1)).allowed).toBe(false);
    expect((await consumeAgentTurn(owner, 1, d2)).allowed).toBe(true);
  });

  it("a limit of 0 turns the assistant off", async () => {
    expect((await consumeAgentTurn("zero@example.test", 0)).allowed).toBe(false);
  });

  it("is atomic: 20 simultaneous turns against a limit of 5 let exactly 5 through", async () => {
    const owner = "race@example.test";
    const all = await Promise.all(Array.from({ length: 20 }, () => consumeAgentTurn(owner, 5)));
    expect(all.filter((r) => r.allowed)).toHaveLength(5);
    const final = await consumeAgentTurn(owner, 5);
    expect(final.allowed).toBe(false);
  });
});

describe("peekAgentTurns", () => {
  it("reports what is left without counting", async () => {
    const { peekAgentTurns } = await import("./usage.js");
    const owner = "peek@example.test";
    expect((await peekAgentTurns(owner, 2)).remaining).toBe(2);
    await consumeAgentTurn(owner, 2);
    const mid = await peekAgentTurns(owner, 2);
    expect(mid).toMatchObject({ used: 1, remaining: 1, exhausted: false });
    await consumeAgentTurn(owner, 2);
    expect((await peekAgentTurns(owner, 2)).exhausted).toBe(true);
    expect((await peekAgentTurns(owner, 2)).used).toBe(2);
  });
});
