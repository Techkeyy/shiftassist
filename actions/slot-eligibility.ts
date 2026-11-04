import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { explainShiftView } from "../server/lib/insight.js";

export interface SlotEligibility {
  slotId: string;
  /** Who holds the shift now, or null when it is open. */
  holderId: string | null;
  /** Everyone else, with the engine's verdict on whether they could take it. */
  people: { staffId: string; name: string; allowed: boolean; blockedBy: string[]; wouldBreakSoft: string[] }[];
}

export default defineAction({
  description:
    "Read-only. For one shift, says which other people could take it and, for each person who can't, the engine's reason. Drives the board's allowed and blocked cells while a shift is picked up. Changes nothing.",
  deferLoading: true,
  schema: z.object({ slotId: z.string().describe("Shift id from get-week slots[].id.") }),
  http: { method: "GET" },
  outputSchema: z.custom<SlotEligibility>(),
  run: async (args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    const e = await explainShiftView(owner, args.slotId);
    return {
      slotId: e.slotId,
      holderId: e.staffId,
      people: e.others.map((o) => ({
        staffId: o.staffId,
        name: o.name,
        allowed: o.allowed,
        blockedBy: o.blockedBy,
        wouldBreakSoft: o.wouldBreakSoft,
      })),
    } satisfies SlotEligibility;
  },
});
