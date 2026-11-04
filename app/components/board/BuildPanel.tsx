import { useActionMutation } from "@agent-native/core/client/hooks";
import { useState } from "react";

import type { BuildResult } from "../../../server/lib/assignments";
import type { WeekView } from "../../../server/lib/week-view";
import { btnPrimary, btnSecondary, errText } from "./format";

export function FairnessStrip({ fairness }: { fairness: NonNullable<WeekView["fairness"]> }) {
  const a = fairness.averages;
  return (
    <div data-testid="fairness" className="space-y-2">
      <h3 className="text-sm font-medium">Fairness this week</h3>
      <ul className="flex flex-wrap gap-2" aria-label="Shifts, closes and weekends per person">
        {fairness.people.map((p) => (
          <li key={p.staffId} className="rounded-md border px-2 py-1 text-xs" data-testid="fairness-person">
            <strong className="text-sm">{p.name}</strong>
            <div className="text-muted-foreground">
              {p.shifts} shifts · {p.closes} closes · {p.weekends} weekend
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Team average: {a.shifts.toFixed(1)} shifts, {a.closes.toFixed(1)} closes, {a.weekends.toFixed(1)} weekend shifts. A "close" is a shift that ends at 22:00 or later. Figures come from the scheduling engine.
      </p>
    </div>
  );
}

export function BuildPanel({
  week,
  onSelectSlot,
}: {
  week: WeekView;
  onSelectSlot: (slotId: string) => void;
}) {
  const build = useActionMutation("build-week");
  const [result, setResult] = useState<BuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const placed = week.slots.filter((s) => s.staffId).length;
  const proposedWaiting = week.rules.filter((r) => r.status === "proposed").length;

  function run() {
    setError(null);
    setConfirming(false);
    build.mutate(
      {},
      {
        onSuccess: (r) => setResult(r),
        onError: (err) => setError(errText(err, "Couldn't build the week. Nothing was changed.")),
      },
    );
  }

  const unfilledNow = week.slots.filter((s) => !s.staffId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <span className="text-sm">Building again replaces every shift that isn't locked.</span>
            <button type="button" className={btnPrimary} onClick={run}>Yes, rebuild</button>
            <button type="button" className={btnSecondary} onClick={() => setConfirming(false)}>No, keep it</button>
          </>
        ) : (
          <button
            type="button"
            className={week.nextStep === "build" ? btnPrimary : btnSecondary}
            disabled={build.isPending}
            data-testid="build-week"
            onClick={() => (placed > 0 ? setConfirming(true) : run())}
          >
            {build.isPending ? "Building the week..." : placed > 0 ? "Build week again" : "Build week"}
          </button>
        )}
      </div>
      {proposedWaiting > 0 ? (
        <p role="status" className="text-sm text-amber-900 dark:text-amber-200">
          {proposedWaiting} rule{proposedWaiting === 1 ? " is" : "s are"} still waiting for your confirmation and will not be used.
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div role="status" data-testid="build-result" className="space-y-2 rounded-lg border p-3 text-sm">
          <p className="font-medium">
            Filled {result.filled} of {result.total} shifts.
            {result.lockedKept ? ` ${result.lockedKept} locked shift(s) kept.` : ""}
          </p>
          {result.lockedProblems.length ? (
            <ul className="list-disc pl-5 text-amber-900 dark:text-amber-200">
              {result.lockedProblems.map((p) => (
                <li key={p.slotId}>
                  Locked {p.description} breaks a rule: {p.problems.join(" ")}
                </li>
              ))}
            </ul>
          ) : null}
          {result.unfilled.length ? (
            <div>
              <p className="font-medium">{result.unfilled.length} shift{result.unfilled.length === 1 ? "" : "s"} could not be filled:</p>
              <ul className="mt-1 space-y-2">
                {result.unfilled.map((u) => (
                  <li key={u.slotId} data-testid="unfilled-shift">
                    <button type="button" className="font-medium underline" onClick={() => onSelectSlot(u.slotId)}>
                      {u.description}
                    </button>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground">
                      {u.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p>Every shift has someone on it.</p>
          )}
        </div>
      ) : unfilledNow.length > 0 && placed > 0 ? (
        <p className="text-sm text-muted-foreground">
          {unfilledNow.length} shift{unfilledNow.length === 1 ? " is" : "s are"} open. Click an open shift on the board to see why.
        </p>
      ) : null}

      {week.fairness ? <FairnessStrip fairness={week.fairness} /> : null}
    </div>
  );
}
