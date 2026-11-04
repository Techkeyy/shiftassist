import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { applyCover, type CoverResult } from "../server/lib/assignments.js";

export default defineAction({
  description:
    "Put a chosen person on a shift for someone who can't make it, after find-cover. Needs the manager's approval. The cover person is checked against every hard rule; if one would break, nothing changes. The person who can't make it is also marked off that day so a rebuild won't put them back. Leave coverStaffId out when nobody can cover: the shift is then left open and the person is still marked off. Returns a prepared message the manager can copy. Nothing is sent.",
  deferLoading: false,
  needsApproval: true,
  schema: z.object({
    slotId: z.string().describe("The shift, from get-week slots[].id."),
    coverStaffId: z
      .string()
      .optional()
      .describe("Id of the person covering, from find-cover options[].staffId. Omit to leave the shift open."),
  }),
  outputSchema: z.custom<CoverResult>(),
  run: async (args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return applyCover(owner, args);
  },
});
