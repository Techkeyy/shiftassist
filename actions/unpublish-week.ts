import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { unpublishWeek } from "../server/lib/publish.js";

export default defineAction({
  description: "Stop sharing the week: the public link stops working immediately. Publishing again makes a new link.",
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
    return unpublishWeek(owner);
  },
});
