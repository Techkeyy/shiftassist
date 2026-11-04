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
        <div data-testid="published" className="space-y-2">
          <p className="text-sm">
            <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-900 dark:bg-green-950 dark:text-green-200">Live</span>{" "}
            Staff can open this link on their phone. It always shows the current rota, so changes you make appear there too.
            {week.week?.isSample ? " It is labelled as a sample." : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            <input readOnly aria-label="Public link" className="min-w-0 flex-1 rounded-md border bg-muted/40 px-2 py-1.5 text-sm" value={link} onFocus={(e) => e.currentTarget.select()} />
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
          {copied === "ok" ? <p role="status" className="text-sm text-muted-foreground">Link copied.</p> : null}
          {copied === "fail" ? <p role="alert" className="text-sm text-destructive">Couldn't copy. Select the link and copy it yourself.</p> : null}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
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
          {!placed ? <p className="text-xs text-muted-foreground">Build the week first, then publish it.</p> : null}
        </div>
      )}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
