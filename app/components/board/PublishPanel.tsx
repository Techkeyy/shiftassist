import { useActionMutation } from "@agent-native/core/client/hooks";
import { useState } from "react";

import type { WeekView } from "../../../server/lib/week-view";
import { btnPrimary, btnSecondary, btnDanger, copyText, errText } from "./format";

export function PublishPanel({ week }: { week: WeekView }) {
  const publish = useActionMutation("publish-week");
  const unpublish = useActionMutation("unpublish-week");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const placed = week.slots.some((s) => s.staffId);
  const link = week.published ? `${window.location.origin}${week.published.path}` : null;

  return (
    <div className="space-y-3">
      {week.published && link ? (
        <div data-testid="published" className="space-y-3">
          <p className="text-[0.9375rem]">
            <span className="badge" style={{ borderColor: "hsl(var(--allowed))", color: "hsl(var(--allowed))" }}>
              Live
            </span>{" "}
            Staff can open this link on their phone. It always shows the current rota, so changes you make appear there too.
            {week.week?.isSample ? " It is labelled as a sample." : ""}
          </p>
          <label className="field-label">
            Public link
            <input readOnly aria-label="Public link" className="field mt-1" value={link} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              onClick={async () => setCopied((await copyText(link)) ? "ok" : "fail")}
            >
              Copy link
            </button>
            <a className={btnSecondary} href={week.published.path} target="_blank" rel="noreferrer">
              Open
            </a>
            <button
              type="button"
              className={btnDanger}
              disabled={unpublish.isPending}
              onClick={() => {
                setError(null);
                unpublish.mutate({}, { onError: (e) => setError(errText(e, "Couldn't stop sharing.")) });
              }}
            >
              {unpublish.isPending ? "Stopping..." : "Stop sharing"}
            </button>
          </div>
          {copied === "ok" ? <p role="status" className="hint">Link copied.</p> : null}
          {copied === "fail" ? <p role="alert" className="problem-line">Couldn't copy. Select the link and copy it yourself.</p> : null}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="hint">
            Publish gives you a private link your staff can open on their phone without signing in. They see the rota and why each person has each shift. They cannot change anything.
          </p>
          <button
            type="button"
            className={week.nextStep === "publish" ? btnPrimary : btnSecondary}
            disabled={publish.isPending || !placed}
            title={!placed ? "Build the week first" : undefined}
            data-testid="publish-week"
            onClick={() => {
              setError(null);
              publish.mutate({}, { onError: (e) => setError(errText(e, "Couldn't publish the week.")) });
            }}
          >
            {publish.isPending ? "Publishing..." : "Publish this week"}
          </button>
          {!placed ? <p className="hint">Build the week first, then publish it.</p> : null}
        </div>
      )}
      {error ? <p role="alert" className="problem-line">{error}</p> : null}
    </div>
  );
}
