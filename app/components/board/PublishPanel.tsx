import { useActionMutation } from "@agent-native/core/client/hooks";
import { useState } from "react";

import type { WeekView } from "../../../server/lib/week-view";
import { btnPrimary, btnSecondary, btnDanger, copyText, errText } from "./format";

export function PublishPanel({ week }: { week: WeekView }) {
  const publish = useActionMutation("publish-week");
  const unpublish = useActionMutation("unpublish-week");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const [stopping, setStopping] = useState(false);
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
            Your staff can open this link on their phone, with no sign-in. It always shows your current week, so changes you make appear there too.
            {week.week?.isSample ? " It is labelled as a sample." : ""}
          </p>
          <label className="field-label">
            Link for your staff
            <input readOnly aria-label="Link for your staff" className="field mt-1" value={link} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} onClick={async () => setCopied((await copyText(link)) ? "ok" : "fail")}>
              Copy link
            </button>
            <a className={btnSecondary} href={week.published.path} target="_blank" rel="noreferrer">
              Open it as your staff see it
            </a>
          </div>
          {copied === "ok" ? <p role="status" className="hint">Link copied. Paste it into your group chat yourself; nothing is sent from here.</p> : null}
          {copied === "fail" ? <p role="alert" className="problem-line">Couldn't copy. Select the link and copy it yourself.</p> : null}
          <div className="stop-sharing">
            {stopping ? (
              <div role="alertdialog" aria-label="Stop sharing" className="flex flex-wrap items-center gap-2">
                <span className="text-[0.9375rem]">Stop sharing? The link stops working for your staff straight away.</span>
                <button
                  type="button"
                  className={btnDanger}
                  disabled={unpublish.isPending}
                  onClick={() => {
                    setError(null);
                    unpublish.mutate({}, { onSuccess: () => setStopping(false), onError: (e) => setError(errText(e, "Couldn't stop sharing.")) });
                  }}
                >
                  {unpublish.isPending ? "Stopping..." : "Yes, stop sharing"}
                </button>
                <button type="button" className={btnSecondary} onClick={() => setStopping(false)}>No, keep sharing</button>
              </div>
            ) : (
              <button type="button" className="link" onClick={() => setStopping(true)}>Stop sharing</button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            className={`${btnPrimary} btn-big`}
            disabled={publish.isPending || !placed}
            title={!placed ? "Build your week first" : undefined}
            data-testid="publish-week"
            onClick={() => {
              setError(null);
              publish.mutate({}, { onError: (e) => setError(errText(e, "Couldn't publish the week.")) });
            }}
          >
            {publish.isPending ? "Publishing..." : "Publish my week"}
          </button>
          <p className="hint">
            You get a private link your staff open on their phone, with no sign-in. They see the week and why each person has each shift. They can't change anything.
          </p>
          {!placed ? <p className="hint">Build your week first, then publish it.</p> : null}
        </div>
      )}
      {error ? <p role="alert" className="problem-line">{error}</p> : null}
    </div>
  );
}
