import { useActionMutation } from "@agent-native/core/client/hooks";
import { useState } from "react";

import type { BuildResult } from "../../../server/lib/assignments";
import type { WeekView } from "../../../server/lib/week-view";
import { Tally } from "./art";
import { btnPrimary, btnSecondary, errText } from "./format";

/** Fairness at a glance: closes and weekend shifts as tally marks, a dotted line for the team average. All from the engine. */
export function FairnessStrip({ fairness }: { fairness: NonNullable<WeekView["fairness"]> }) {
  const a = fairness.averages;
  const maxCloses = Math.max(...fairness.people.map((p) => p.closes), 0);
  const maxWeekends = Math.max(...fairness.people.map((p) => p.weekends), 0);
  return (
    <section data-testid="fairness" aria-labelledby="tally-h" className="space-y-1">
      <h3 id="tally-h" className="section-title">Fairness this week</h3>
      <p className="hint">
        A close is a shift that ends at 22:00 or later. The dotted line is the team average (
        <span className="mono">{a.closes.toFixed(1)}</span> closes, <span className="mono">{a.weekends.toFixed(1)}</span> weekend shifts). Figures come from the scheduling engine.
      </p>
      <div role="list" aria-label="Closes and weekend shifts per person" className="mt-2">
        <div className="tally-row hint" aria-hidden="true" style={{ borderTop: 0, paddingBottom: 0 }}>
          <span>Person</span>
          <span>Closes</span>
          <span>Weekend shifts</span>
        </div>
        {fairness.people.map((p) => (
          <div key={p.staffId} role="listitem" className="tally-row" data-testid="fairness-person">
            <span>
              <strong className="display text-base">{p.name}</strong>
              <span className="hint mono block">{p.shifts} shifts</span>
            </span>
            <span className="tally-marks">
              <Tally count={p.closes} average={a.closes} max={maxCloses} label={`${p.name}, closes`} />
              <span className="mono text-sm">{p.closes}</span>
            </span>
            <span className="tally-marks">
              <Tally count={p.weekends} average={a.weekends} max={maxWeekends} label={`${p.name}, weekend shifts`} />
              <span className="mono text-sm">{p.weekends}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
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
            <span className="text-[0.9375rem]">Building again replaces every shift that isn't locked.</span>
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
        {proposedWaiting > 0 ? (
          <span role="status" className="hint">
            {proposedWaiting} rule{proposedWaiting === 1 ? " is" : "s are"} still waiting for your confirmation and will not be used.
          </span>
        ) : null}
      </div>
      {error ? <p role="alert" className="problem-line">{error}</p> : null}

      {result ? (
        <div role="status" data-testid="build-result" className="space-y-2 border-l-4 pl-3 text-[0.9375rem]" style={{ borderColor: "hsl(var(--foreground))" }}>
          <p className="font-medium">
            Filled <span className="mono">{result.filled}</span> of <span className="mono">{result.total}</span> shifts.
            {result.lockedKept ? ` ${result.lockedKept} locked shift(s) kept.` : ""}
          </p>
          {result.lockedProblems.length ? (
            <ul className="list-disc pl-5" style={{ color: "hsl(var(--problem))" }}>
              {result.lockedProblems.map((p) => (
                <li key={p.slotId}>
                  Locked {p.description} breaks a rule: {p.problems.join(" ")}
                </li>
              ))}
            </ul>
          ) : null}
          {result.unfilled.length ? (
            <div>
              <p className="problem-line">
                {result.unfilled.length} shift{result.unfilled.length === 1 ? "" : "s"} could not be filled:
              </p>
              <ul className="mt-1 space-y-2">
                {result.unfilled.map((u) => (
                  <li key={u.slotId} data-testid="unfilled-shift">
                    <button type="button" className="link font-medium" onClick={() => onSelectSlot(u.slotId)}>
                      {u.description}
                    </button>
                    <ul className="hint list-disc pl-5">
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
        <p className="hint">
          {unfilledNow.length} shift{unfilledNow.length === 1 ? " is" : "s are"} open. Click an open shift on the sheet to see why.
        </p>
      ) : null}
    </div>
  );
}
