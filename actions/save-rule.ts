import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { ruleFields, saveRule } from "../server/lib/rules.js";

export default defineAction({
  description:
    "Add a rule by hand, or edit an existing rule (pass id), on the manager's say-so. The rule is saved as confirmed and used by the schedule. Needs the manager's approval. staffId is required here.",
  deferLoading: false,
  needsApproval: true,
  schema: z.object({
    ...ruleFields,
    id: z.string().optional().describe("Id of the rule to edit. Omit to add a new rule."),
    source: z.string().max(500).optional().describe("The sentence or note the rule came from."),
  }),
  outputSchema: z.object({ id: z.string(), text: z.string() }),
  run: async (args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return saveRule(owner, args);
  },
});
