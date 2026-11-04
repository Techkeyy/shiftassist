import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { buildWeek, type BuildResult } from "../server/lib/assignments.js";

export default defineAction({
  description:
    "Build the week: the scheduling engine fills every shift from the CONFIRMED rules, keeping locked shifts. Replaces all unlocked placements in one step. Returns how many shifts were filled, every shift that could not be filled with the engine's true reasons, and fairness per person (closes, weekends, shifts). Proposed rules are not used; say so if any are waiting.",
  deferLoading: false,
  schema: z.object({}),
  outputSchema: z.custom<BuildResult>(),
  run: async (_args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return buildWeek(owner);
  },
});
