import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { proposeItemSchema, proposeRules } from "../server/lib/rules.js";

export default defineAction({
  description:
    "Store rules read from the staff's pasted messages as PROPOSED cards for the manager to review. Proposed rules are never used by the schedule until the manager confirms them. Call once with every rule found. Put the staff member's original sentence in 'source'. Give staffName as written; a name that is not on staff, or is ambiguous, becomes a card flagged 'needs a person' (do not drop it, do not guess). Use weekday names for repeating rules and real YYYY-MM-DD dates from the week on the board for one-offs. Never confirm rules yourself.",
  deferLoading: false,
  schema: z.object({
    rules: z.array(proposeItemSchema).min(1).max(60).describe("One entry per rule found in the messages."),
  }),
  outputSchema: z.object({
    stored: z.number(),
    flagged: z.number(),
    duplicatesSkipped: z.number(),
    cards: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        needsAPerson: z.boolean(),
        flag: z.string().nullable(),
      }),
    ),
    message: z.string(),
  }),
  run: async (args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return proposeRules(owner, args.rules);
  },
});
