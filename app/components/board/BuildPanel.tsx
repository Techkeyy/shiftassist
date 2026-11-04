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
}: {
  week: WeekView;
  onResult: (r: BuildResult) => void;
  onError: (message: string) => void;
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
      className={week.nextStep === "build" ? btnPrimary : btnSecondary}
      disabled={build.isPending}
      data-testid="build-week"
      onClick={() => (placed > 0 ? setConfirming(true) : run())}
    >
      {build.isPending ? "Building the week..." : placed > 0 ? "Build week again" : "Build week"}
    </button>
  );
}

/** What the build did, in one line; details only when something needs a person. */
export function BuildResultLine({
  result,
  onSelectSlot,
  onDismiss,
}: {
  result: BuildResult;
  onSelectSlot: (slotId: string) => void;
  onDismiss: () => void;
}) {
  const [open, setOpen] = useState(false);
  const issues = result.unfilled.length + result.lockedProblems.length;
  return (
    <div role="status" data-testid="build-result" className="board-note" data-kind={issues ? "problem" : "ok"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium">
          Week built. Filled {result.filled} of {result.total} shifts.
          {result.lockedKept ? ` ${result.lockedKept} locked kept.` : ""}
          {result.unfilled.length ? ` ${result.unfilled.length} could not be filled.` : ""}
        </span>
        {issues ? (
          <button type="button" className="link" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? "Hide details" : "Show details"}
          </button>
        ) : null}
        <button type="button" className="link ml-auto" onClick={onDismiss}>Dismiss</button>
      </div>
      {open ? (
        <div className="mt-1 max-h-40 overflow-auto space-y-1 text-[0.9375rem]">
          {result.lockedProblems.map((p) => (
            <p key={p.slotId} className="problem-line">Locked {p.description} breaks a rule: {p.problems.join(" ")}</p>
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
  );
}
