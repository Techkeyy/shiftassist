import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { confirmRules } from "../server/lib/rules.js";

export default defineAction({
  description:
    "Confirm proposed rules so the schedule uses them: pass ids, or all:true for every proposed rule. This needs the manager's approval each time. Only call it when the manager has clearly told you in chat to confirm (for example 'confirm them all'). Rules flagged as needing a person or more detail are not confirmed.",
  deferLoading: false,
  needsApproval: true,
  schema: z.object({
    ids: z.array(z.string()).max(100).optional().describe("Rule ids to confirm."),
    all: z.boolean().optional().describe("true = confirm every proposed rule that is not flagged."),
  }),
  outputSchema: z.object({
    confirmed: z.number(),
    stillFlagged: z.array(z.object({ id: z.string(), flag: z.string() })),
  }),
  run: async (args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return confirmRules(owner, args);
  },
});
