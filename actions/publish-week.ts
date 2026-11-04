import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { publishWeek } from "../server/lib/publish.js";

export default defineAction({
  description:
    "Publish the week: creates a private, unguessable read-only link staff can open on a phone without logging in. It always shows the current rota. Safe to repeat (returns the same link). Tell the manager the link path; they copy it from the board.",
  deferLoading: false,
  schema: z.object({}),
  outputSchema: z.object({
    published: z.boolean(),
    token: z.string().nullable(),
    path: z.string().nullable(),
    publishedAt: z.string().nullable(),
  }),
  run: async (_args, ctx) => {
    const owner = ctx?.userEmail;
    if (!owner) throw new Error("Not signed in.");
    return publishWeek(owner);
  },
});
