import { defineAction, NoWriteError } from "@agent-native/core/action";
import { z } from "zod";

import { ownerHasData, writeSampleWeek } from "../server/lib/sample.js";

export default defineAction({
  description:
    "Create a clearly labelled SAMPLE restaurant (8 staff, one week of shifts, a few confirmed rules, already scheduled) for the current user. If the user already has a week this refuses, unless replace is true, which deletes their current week and loads the sample instead.",
  deferLoading: false,
  schema: z.object({
    replace: z
      .boolean()
      .optional()
      .describe(
        "Set true ONLY if the user explicitly asked to throw away their current week and start from the sample. Omit (false) otherwise.",
      ),
  }),
  outputSchema: z.object({
    loaded: z.boolean(),
    replaced: z.boolean(),
    weekName: z.string(),
    startDate: z.string(),
    staffCount: z.number(),
    slotCount: z.number(),
    assignedCount: z.number(),
    unfilledCount: z.number(),
  }),
  run: async (args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    const replace = args.replace === true;
    if (!replace && (await ownerHasData(owner))) {
      throw new NoWriteError(
        "You already have a week. Ask to replace it with the sample (replace: true) if you really want to start over.",
        { errorCode: "week_exists", statusCode: 409 },
      );
    }
    return writeSampleWeek(owner, { replace });
  },
});
