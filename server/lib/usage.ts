import { and, eq, lt, sql } from "drizzle-orm";

import { getDb } from "../db/index.js";
import { agentUsage } from "../db/schema.js";

export const DEFAULT_DAILY_AGENT_TURNS = 40;

/** What the manager reads when the day's assistant turns are used up. */
export const DAILY_LIMIT_MESSAGE =
  "You've used today's assistant limit. The board, rules and sharing all still work.";

/** Turns per account per UTC day: env SHIFTASSIST_DAILY_AGENT_TURNS, else 40. 0 turns the assistant off. */
export function dailyAgentTurnLimit(env: Record<string, string | undefined> = process.env): number {
  const raw = env.SHIFTASSIST_DAILY_AGENT_TURNS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return DEFAULT_DAILY_AGENT_TURNS;
  return Math.min(Number(raw), 100000);
}

export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Counts one assistant turn for this account today, if there is room. One statement does the
 * check and the increment, so two turns at once can never both take the last slot.
 */
export async function consumeAgentTurn(
  owner: string,
  limit: number = dailyAgentTurnLimit(),
  now: Date = new Date(),
): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (limit < 1) return { allowed: false, used: 0, limit };
  const day = utcDay(now);
  const rows = await getDb()
    .insert(agentUsage)
    .values({ ownerEmail: owner, day, turns: 1 })
    .onConflictDoUpdate({
      target: [agentUsage.ownerEmail, agentUsage.day],
      set: { turns: sql`${agentUsage.turns} + 1` },
      setWhere: lt(agentUsage.turns, limit),
    })
    .returning({ turns: agentUsage.turns });
  if (rows.length === 0) return { allowed: false, used: limit, limit };
  return { allowed: true, used: rows[0]!.turns, limit };
}

/** How many assistant turns this account has left today. Reads only; counts nothing. */
export async function peekAgentTurns(
  owner: string,
  limit: number = dailyAgentTurnLimit(),
  now: Date = new Date(),
): Promise<{ used: number; limit: number; remaining: number; exhausted: boolean }> {
  const rows = await getDb()
    .select({ turns: agentUsage.turns })
    .from(agentUsage)
    .where(and(eq(agentUsage.ownerEmail, owner), eq(agentUsage.day, utcDay(now))));
  const used = rows[0]?.turns ?? 0;
  const remaining = Math.max(0, limit - used);
  return { used, limit, remaining, exhausted: remaining === 0 };
}
