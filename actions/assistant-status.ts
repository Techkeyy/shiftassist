import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { DAILY_LIMIT_MESSAGE, peekAgentTurns } from "../server/lib/usage.js";

export default defineAction({
  description:
    "How many assistant turns the signed-in account has left today. Costs nothing and counts nothing. The board, rules, scheduling and sharing never need the assistant, so they work whatever this says.",
  deferLoading: true,
  schema: z.object({}),
  http: { method: "GET" },
  outputSchema: z.object({
    used: z.number(),
    limit: z.number(),
    remaining: z.number(),
    exhausted: z.boolean(),
    message: z.string().nullable(),
  }),
  run: async (_args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    const s = await peekAgentTurns(owner);
    return { ...s, message: s.exhausted ? DAILY_LIMIT_MESSAGE : null };
  },
});
