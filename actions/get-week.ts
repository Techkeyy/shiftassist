import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { buildWeekView, type WeekView } from "../server/lib/week-view.js";

export default defineAction({
  description:
    "Read the current user's restaurant week: the week start date, staff (ids, roles, shifts so far), every shift slot (id, day, time, role, who holds it, locked), ALL rules with their status (proposed = waiting for the manager, confirmed = in use) and the person each is about, fairness per person, whether the week is published, and the next step. Call this first to turn names like 'Maya' or 'Friday dinner' into the ids other actions need.",
  deferLoading: false,
  schema: z.object({}),
  http: { method: "GET" },
  outputSchema: z.custom<WeekView>(),
  run: async (_args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return buildWeekView(owner);
  },
});
