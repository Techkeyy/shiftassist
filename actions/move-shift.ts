import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { moveShift } from "../server/lib/assignments.js";

export default defineAction({
  description:
    "Put one person on one shift (move it from whoever has it now, or fill an empty shift). Hard rules (availability, role, max shifts, rest, no overlaps, no double shifts) are checked on the server: if the move would break one it is refused with a plain-English reason and nothing changes. Repeating the same move changes nothing. Look up slotId and staffId with get-week first; never guess ids. Optionally lock the shift so later repairs leave it alone.",
  deferLoading: false,
  schema: z.object({
    slotId: z
      .string()
      .describe("Id of the shift slot to fill, from get-week slots[].id."),
    staffId: z
      .string()
      .describe(
        "Id of the person who should work it, from get-week staff[].id (resolve names like 'Maya' through get-week).",
      ),
    lock: z
      .boolean()
      .optional()
      .describe(
        "true = lock this shift to this person; false = unlock it; omit = keep the current lock state (a newly moved shift starts unlocked).",
      ),
  }),
  outputSchema: z.object({
    changed: z.boolean(),
    slotId: z.string(),
    slotDescription: z.string(),
    staffId: z.string(),
    staffName: z.string(),
    locked: z.boolean(),
    previousStaffId: z.string().nullable(),
    previousStaffName: z.string().nullable(),
    displaced: z.object({ staffId: z.string(), name: z.string() }).nullable(),
    repaired: z.array(
      z.object({
        slotId: z.string(),
        slotDescription: z.string(),
        fromStaffName: z.string(),
        toStaffName: z.string().nullable(),
      }),
    ),
    message: z.string(),
  }),
  run: async (args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return moveShift(owner, args);
  },
});
