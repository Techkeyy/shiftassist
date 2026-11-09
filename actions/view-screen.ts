import { defineAction } from "@agent-native/core/action";
import {
  readAppState,
  readAppStateForCurrentTab,
} from "@agent-native/core/application-state";
import { z } from "zod";

import { buildWeekView } from "../server/lib/week-view.js";

export default defineAction({
  description:
    "Read the app's current navigation state, the selected shift, and (on the board) a compact snapshot of the week: who works what, open shifts, and the selected shift. Basic navigation is already included in <current-screen>; use this action for a fresh read.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async (_args, ctx) => {
    const navigation = await readAppState("navigation");
    const selection = await readAppStateForCurrentTab("selection");

    const screen: Record<string, unknown> = {};
    if (navigation) screen.navigation = navigation;
    if (selection) screen.selection = selection;

    const view = (navigation as { view?: string } | null)?.view;
    const owner = ctx?.userEmail;
    if ((view === "board" || view === "team" || view === "rules" || view === "week" || view === "share" || view === "home") && owner) {
      const w = await buildWeekView(owner);
      if (!w.hasWeek) {
        screen.board = { hasWeek: false, hint: "No week yet. The user can try the sample restaurant or set up their own restaurant on the Home page." };
      } else {
        const perPerson: Record<string, string[]> = {};
        for (const s of w.slots) {
          if (s.staffName) (perPerson[s.staffName] ??= []).push(`${s.description}${s.locked ? " (locked)" : ""}`);
        }
        const selectedId = (selection as { slotId?: string } | null)?.slotId;
        const selected = selectedId ? w.slots.find((s) => s.id === selectedId) : undefined;
        screen.board = {
          hasWeek: true,
          week: w.week,
          shiftsByPerson: perPerson,
          openShifts: w.slots.filter((s) => !s.staffId).map((s) => ({ slotId: s.id, description: s.description })),
          selectedShift: selected ?? null,
          proposedRules: w.rules.filter((r) => r.status === "proposed").map((r) => ({ id: r.id, text: r.text, flag: r.flag })),
          nextStep: w.nextStep,
          next: "Use get-week for ids, then move-shift to change who works a shift.",
        };
      }
    }

    if (Object.keys(screen).length === 0) {
      return "No application state found. Is the app running?";
    }
    return screen;
  },
});
