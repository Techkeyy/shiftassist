import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { explainShiftView, type ShiftExplanation } from "../server/lib/insight.js";

export default defineAction({
  description:
    "Why does this shift have this person? Returns the scheduling engine's own reasons, and for everyone else whether they could have had it and what blocks them. The reasons are facts from the engine: explain them in plain words, add nothing.",
  deferLoading: false,
  schema: z.object({ slotId: z.string().describe("Shift id from get-week slots[].id.") }),
  http: { method: "GET" },
  outputSchema: z.custom<ShiftExplanation>(),
  run: async (args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return explainShiftView(owner, args.slotId);
  },
});
