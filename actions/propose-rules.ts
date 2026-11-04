import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { noteItemSchema, proposeItemSchema, proposeRules } from "../server/lib/rules.js";

export default defineAction({
  description:
    "Store rules read from the staff's pasted messages as PROPOSED cards for the manager to review. Proposed rules are never used by the schedule until the manager confirms them. Call once with every rule found. Put the staff member's original sentence in 'source'. Give staffName as written; a name that is not on staff, or is ambiguous, becomes a card flagged 'needs a person' (do not drop it, do not guess). Use weekday names for repeating rules and real YYYY-MM-DD dates from the week on the board for one-offs. Never confirm rules yourself. A message that is NOT a rule (a swap request such as 'Ana asked if she can swap with Tom on Saturday', a question, thanks) goes in 'notes' with the original sentence: it is kept as a flagged 'Needs your eye' note card, never reaches the schedule, and the manager can dismiss it or turn it into a rule. Never drop a message.",
  deferLoading: false,
  schema: z.object({
    rules: z.array(proposeItemSchema).max(60).default([]).describe("One entry per rule found in the messages."),
    notes: z
      .array(noteItemSchema)
      .max(60)
      .default([])
      .describe("One entry per message that is not a rule (swap requests, questions). Same original wording in 'source'."),
  }),
  outputSchema: z.object({
    stored: z.number(),
    notes: z.number(),
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
    if (args.rules.length + args.notes.length === 0) throw new Error("Nothing to store. Give at least one rule or note.");
    return proposeRules(owner, args.rules, args.notes);
  },
});
