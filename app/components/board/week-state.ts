import { useActionQuery, useDbSync } from "@agent-native/core/client/hooks";
import { useQueryClient } from "@tanstack/react-query";

import type { WeekView } from "../../../server/lib/week-view";
import { TAB_ID } from "@/lib/tab-id";
import { STEP_DEFS, type Step } from "./TopBar";

/** The owner's week, kept in sync when the assistant, another tab or a script changes it. */
export function useWeek() {
  const queryClient = useQueryClient();
  useDbSync({
    queryClient,
    ignoreSource: TAB_ID,
    realtime: { reason: "the assistant, another tab or a script can change the week while this page is open" },
    pauseWhenHidden: true,
  });
  return useActionQuery("get-week", {});
}

export interface Facts {
  people: number;
  shifts: number;
  filled: number;
  open: number;
  proposed: number;
  inUse: number;
  published: boolean;
  placed: boolean;
}

export function factsOf(w: WeekView): Facts {
  const filled = w.slots.filter((s) => s.staffId).length;
  return {
    people: w.staff.length,
    shifts: w.slots.length,
    filled,
    open: w.slots.length - filled,
    proposed: w.rules.filter((r) => r.status === "proposed" && r.kind !== "note").length,
    inUse: w.rules.filter((r) => r.status === "confirmed" && r.kind !== "note").length,
    published: Boolean(w.published),
    placed: filled > 0,
  };
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function stepsOf(w: WeekView): Step[] {
  const f = factsOf(w);
  const note: Record<string, string> = {
    team: `${plural(f.people, "person", "people")}, ${plural(f.shifts, "shift")}`,
    rules: `${f.inUse} in use${f.proposed ? `, ${f.proposed} waiting` : ""}`,
    week: f.placed ? `${f.filled} of ${f.shifts} filled` : "Not built yet",
    share: f.published ? "Live" : "Not shared",
  };
  const done: Record<string, boolean> = {
    team: w.hasWeek,
    rules: f.proposed === 0 && f.inUse > 0,
    week: f.placed,
    share: f.published,
  };
  return STEP_DEFS.map((d) => ({
    ...d,
    done: Boolean(done[d.id]),
    note: note[d.id]!,
    ...(d.id === "rules" && f.proposed > 0 ? { badge: `${f.proposed} waiting` } : {}),
  }));
}

export interface NextStep {
  sentence: string;
  button: string;
  to: string;
}

/** The one thing to do next, from real state only. */
export function nextStepOf(w: WeekView): NextStep {
  const f = factsOf(w);
  if (f.proposed > 0) {
    return { sentence: `${plural(f.proposed, "staff message")} ${f.proposed === 1 ? "needs" : "need"} your check.`, button: "Check them", to: "/rules" };
  }
  if (!f.placed && f.inUse === 0) return { sentence: "Add your staff's messages, so the week keeps their rules.", button: "Add messages", to: "/rules" };
  if (!f.placed) return { sentence: "Your rules are ready. Build the week.", button: "Build my week", to: "/week" };
  if (f.open > 0) return { sentence: `${plural(f.open, "shift")} ${f.open === 1 ? "has" : "have"} nobody on ${f.open === 1 ? "it" : "them"}.`, button: "Fix it", to: "/week" };
  if (!f.published) return { sentence: "Your week is ready. Share it with your staff.", button: "Share", to: "/share" };
  return { sentence: "Your week is live. Staff can see it now.", button: "See the week", to: "/week" };
}
