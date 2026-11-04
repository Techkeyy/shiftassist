import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { findCoverView, type CoverOptions } from "../server/lib/insight.js";

export default defineAction({
  description:
    "Someone can't make a shift: list who could cover it, best first, with the engine's reasons and overtime cost. Never includes the person who can't make it. If nobody can, 'blocked' says why for each person. Read only. Then ask the manager which option; apply-cover makes the change.",
  deferLoading: false,
  schema: z.object({ slotId: z.string().describe("The shift that needs cover, from get-week slots[].id.") }),
  http: { method: "GET" },
  outputSchema: z.custom<CoverOptions>(),
  run: async (args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return findCoverView(owner, args.slotId);
  },
});
