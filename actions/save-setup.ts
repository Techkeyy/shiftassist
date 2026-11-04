import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { patternInput, saveSetup, staffInput } from "../server/lib/setup.js";

export default defineAction({
  description:
    "Create or edit the restaurant's staff and its typical week of shifts for a chosen week start date. For a new restaurant this creates the week. For an existing one it updates people (pass their id to keep them and their rules) and, if the shift pattern changed, regenerates the shifts. Anything that would clear the schedule already placed is refused until confirmReplace is true, so ask the manager first. Does not build the schedule; use build-week.",
  deferLoading: false,
  schema: z.object({
    weekStart: z.string().describe("First day of the week, YYYY-MM-DD (usually a Monday). The week is 7 days from here."),
    name: z.string().max(80).optional().describe("Optional name for the week, e.g. 'Week of 9 Nov'."),
    staff: z.array(staffInput).min(1).max(60).describe("The whole staff list. People left out of an edit are removed."),
    pattern: z.array(patternInput).min(1).max(30).describe("The typical week: one line per shift type."),
    confirmReplace: z
      .boolean()
      .optional()
      .describe("true ONLY after the manager agreed to replace the current schedule or sample. Default false."),
  }),
  outputSchema: z.object({
    created: z.boolean(),
    weekName: z.string(),
    startDate: z.string(),
    staffCount: z.number(),
    slotCount: z.number(),
    assignmentsCleared: z.number(),
    rulesKept: z.number(),
    warnings: z.array(z.string()),
  }),
  run: async (args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return saveSetup(owner, args);
  },
});
