import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { buildWeekView } from "../server/lib/week-view.js";

export default defineAction({
  description:
    "Read the current user's restaurant week: staff (with ids, roles, shift counts), every shift slot (with id, day, time, role, and who holds it, if anyone), and the confirmed rules in plain English. Call this first to turn names like 'Maya' or 'Friday dinner' into the ids that move-shift needs.",
  deferLoading: false,
  schema: z.object({}),
  http: { method: "GET" },
  outputSchema: z.object({
    hasWeek: z.boolean(),
    week: z
      .object({ name: z.string(), startDate: z.string(), isSample: z.boolean() })
      .nullable(),
    staff: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        roles: z.array(z.string()),
        maxShifts: z.number(),
        shiftCount: z.number(),
      }),
    ),
    slots: z.array(
      z.object({
        id: z.string(),
        date: z.string(),
        start: z.string(),
        end: z.string(),
        role: z.string(),
        label: z.string(),
        description: z.string(),
        staffId: z.string().nullable(),
        staffName: z.string().nullable(),
        locked: z.boolean(),
      }),
    ),
    rules: z.array(
      z.object({
        id: z.string(),
        staffId: z.string(),
        staffName: z.string(),
        severity: z.enum(["hard", "soft"]),
        kind: z.string(),
        text: z.string(),
      }),
    ),
    unfilledSlotIds: z.array(z.string()),
  }),
  run: async (_args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return buildWeekView(owner);
  },
});
