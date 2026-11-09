import { useActionMutation } from "@agent-native/core/client/hooks";
import { useState } from "react";

import type { BuildResult } from "../../../server/lib/assignments";
import type { WeekView } from "../../../server/lib/week-view";
import { btnPrimary, btnSecondary, errText } from "./format";

/** The Build week button, with its "replace everything" check. The result goes up to the board's one-line summary. */
export function BuildControl({
  week,
  onResult,
  onError,
  primary,
  big,
}: {
  week: WeekView;
  onResult: (r: BuildResult) => void;
  onError: (message: string) => void;
  primary?: boolean;
  big?: boolean;
}) {
  const build = useActionMutation("build-week");
  const [confirming, setConfirming] = useState(false);
  const placed = week.slots.filter((s) => s.staffId).length;

  function run() {
    setConfirming(false);
    build.mutate(
      {},
      {
        onSuccess: (r) => onResult(r),
        onError: (err) => onError(errText(err, "Couldn't build the week. Nothing was changed.")),
      },
    );
  }

  if (confirming) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <span className="text-[0.9375rem]">Building again replaces every shift that isn't locked.</span>
        <button type="button" className={btnPrimary} onClick={run}>Yes, rebuild</button>
        <button type="button" className={btnSecondary} onClick={() => setConfirming(false)}>No, keep it</button>
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`${primary ? btnPrimary : btnSecondary}${big ? " btn-big" : ""}`}
      disabled={build.isPending}
      data-testid="build-week"
      onClick={() => (placed > 0 ? setConfirming(true) : run())}
    >
      {build.isPending ? "Building the week..." : placed > 0 ? "Build the week again" : "Build my week"}
    </button>
  );
}

/** What the build did, in plain words; details only when something needs a person. */
export function BuildResultLine({
  result,
  onSelectSlot,
  onDismiss,
}: {
  result: BuildResult;
  onSelectSlot: (slotId: string) => void;
  onDismiss: () => void;
}) {
  const issues = result.unfilled.length + result.lockedProblems.length;
  const all = result.unfilled.length === 0;
  return (
    <div role="status" data-testid="build-result" className="board-note build-result" data-kind={issues ? "problem" : "ok"}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {all
            ? `Everyone is placed. ${result.filled} of ${result.total} shifts filled, and every confirmed rule is kept.`
            : `${result.filled} of ${result.total} shifts filled. ${result.unfilled.length} ${result.unfilled.length === 1 ? "shift has" : "shifts have"} nobody on ${result.unfilled.length === 1 ? "it" : "them"}.`}
          {result.lockedKept ? ` ${result.lockedKept} locked ${result.lockedKept === 1 ? "shift was" : "shifts were"} kept.` : ""}
          {result.proposedRulesIgnored ? ` ${result.proposedRulesIgnored} ${result.proposedRulesIgnored === 1 ? "rule is" : "rules are"} still waiting for your check and ${result.proposedRulesIgnored === 1 ? "was" : "were"} not used.` : ""}
        </p>
        {issues ? (
          <div className="mt-1 max-h-40 overflow-auto space-y-1 text-[0.9375rem]">
            {result.lockedProblems.map((p) => (
              <p key={p.slotId} className="problem-line">The locked shift {p.description} breaks a rule: {p.problems.join(" ")}</p>
            ))}
            {result.unfilled.map((u) => (
              <p key={u.slotId} data-testid="unfilled-shift">
                <button type="button" className="link font-medium" onClick={() => onSelectSlot(u.slotId)}>{u.description}</button>
                <span className="hint">: {u.reasons.join(" ")}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <button type="button" className="link shrink-0" onClick={onDismiss}>Dismiss</button>
    </div>
  );
}
