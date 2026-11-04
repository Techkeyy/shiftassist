import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { deleteRule } from "../server/lib/rules.js";

export default defineAction({
  description: "Delete one rule (proposed or confirmed) by id. Only when the manager asks.",
  schema: z.object({ id: z.string().describe("Rule id from get-week rules[].id.") }),
  outputSchema: z.object({ deleted: z.boolean() }),
  run: async (args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return deleteRule(owner, args.id);
  },
});
