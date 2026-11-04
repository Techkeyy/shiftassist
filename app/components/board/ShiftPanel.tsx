import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useState } from "react";

import type { WeekView } from "../../../server/lib/week-view";
import { btnDanger, btnPrimary, btnSecondary, errText } from "./format";

type Slot = WeekView["slots"][number];

function CoverFlow({ slot, onClose, onNotice }: { slot: Slot; onClose: () => void; onNotice: (n: { kind: "ok" | "error"; text: string }) => void }) {
  const cover = useActionQuery("find-cover", { slotId: slot.id });
  const apply = useActionMutation("apply-cover");
  const [error, setError] = useState<string | null>(null);

  function choose(staffId: string | undefined, name: string | null) {
    setError(null);
    apply.mutate(
      { slotId: slot.id, ...(staffId ? { coverStaffId: staffId } : {}) },
      {
        onSuccess: (r) => {
          onNotice({ kind: "ok", text: r.summary });
          onClose();
        },
        onError: (err) =>
          setError(errText(err, name ? `Couldn't put ${name} on that shift. Nothing was changed.` : "Couldn't update the shift.")),
      },
    );
  }

  if (cover.isLoading) return <p role="status" className="text-sm text-muted-foreground">Looking for cover...</p>;
  if (cover.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errText(cover.error, "Couldn't look for cover.")}{" "}
        <button type="button" className="underline" onClick={() => void cover.refetch()}>Try again</button>
      </p>
    );
  }
  const data = cover.data!;
  return (
    <div className="space-y-3 rounded-lg border p-3" data-testid="cover-flow">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{data.absentName} can't make it. Who can cover?</h3>
        <button type="button" className="text-xs underline" onClick={onClose}>Cancel</button>
      </div>
      {data.options.length === 0 ? (
        <div className="space-y-2 text-sm">
          <p className="font-medium">Nobody can cover this shift.</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {data.blocked.map((b) => (
              <li key={b.staffId}>
                <strong className="text-foreground">{b.name}:</strong> {b.blockedBy.join(" ") || "Not available."}
              </li>
            ))}
          </ul>
          <button type="button" className={btnDanger} disabled={apply.isPending} onClick={() => choose(undefined, null)}>
            {apply.isPending ? "Saving..." : `Mark ${data.absentName} off and leave the shift open`}
          </button>
        </div>
      ) : (
        <ol className="space-y-2" aria-label="Cover options, best first">
          {data.options.map((o, i) => (
            <li key={o.staffId} className="rounded-md border p-2 text-sm" data-testid="cover-option">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {i + 1}. {o.name}
                  {o.overtimeCost > 0 ? <span className="ml-2 text-xs text-amber-800 dark:text-amber-300">overtime cost {o.overtimeCost}</span> : null}
                </span>
                <button type="button" className={btnPrimary} disabled={apply.isPending} onClick={() => choose(o.staffId, o.name)}>
                  {apply.isPending ? "Saving..." : `Choose ${o.name}`}
                </button>
              </div>
              <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                {o.reasons.map((r, k) => (
                  <li key={k}>{r}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {data.options.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Choosing someone changes the rota and marks {data.absentName} off that day. Nothing is sent to anyone.
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function ShiftPanel({
  slot,
  week,
  onClose,
  onMove,
  moving,
  onNotice,
}: {
  slot: Slot;
  week: WeekView;
  onClose: () => void;
  onMove: (staffId: string, lock?: boolean) => void;
  moving: boolean;
  onNotice: (n: { kind: "ok" | "error"; text: string }) => void;
}) {
  const why = useActionQuery("explain-shift", { slotId: slot.id });
  const [covering, setCovering] = useState(false);

  function askWhy() {
    if (!why.data) return;
    sendToAgentChat({
      message: `Explain in plain words, in two or three short sentences, why ${slot.staffName ?? "nobody"} has the ${slot.description} shift. Use only the engine's reasons in the context. Do not invent reasons.`,
      context: why.data.summary,
      contextLabel: `Why: ${slot.description}`,
      submit: true,
      openSidebar: true,
    });
  }

  return (
    <section aria-label="Selected shift" data-testid="shift-panel" className="space-y-3 rounded-lg border p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{slot.description}</h3>
          <p className="text-sm text-muted-foreground">
            {slot.staffName ? `Worked by ${slot.staffName}` : "Nobody is on this shift"}
            {slot.locked ? " · locked" : ""}
          </p>
        </div>
        <button type="button" className={btnSecondary} onClick={onClose} aria-label="Close shift details">
          Close
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          Move to...
          <select
            className="mt-1 block rounded-md border bg-background px-2 py-1.5 text-sm"
            aria-label="Move this shift to"
            data-testid="move-to"
            value=""
            disabled={moving}
            onChange={(e) => {
              if (e.target.value) onMove(e.target.value);
            }}
          >
            <option value="">Choose a person</option>
            {week.staff.map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === slot.staffId}>
                {s.name}
                {s.id === slot.staffId ? " (has it now)" : ""}
              </option>
            ))}
          </select>
        </label>
        {slot.staffId ? (
          <button type="button" className={btnSecondary} disabled={moving} onClick={() => onMove(slot.staffId!, !slot.locked)}>
            {slot.locked ? "Unlock this shift" : `Lock to ${slot.staffName}`}
          </button>
        ) : null}
        {slot.staffId ? (
          <button type="button" className={btnSecondary} onClick={() => setCovering(true)} disabled={covering}>
            Someone can't make it
          </button>
        ) : null}
        <button type="button" className={btnSecondary} onClick={askWhy} disabled={!why.data} title="Your assistant explains it in plain words">
          Ask why
        </button>
      </div>

      {covering ? <CoverFlow slot={slot} onClose={() => setCovering(false)} onNotice={onNotice} /> : null}

      <div data-testid="why-panel">
        <h4 className="text-sm font-medium">{slot.staffId ? `Why ${slot.staffName}?` : "Why is this shift open?"}</h4>
        {why.isLoading ? (
          <p role="status" className="text-sm text-muted-foreground">Checking the rules...</p>
        ) : why.error ? (
          <p role="alert" className="text-sm text-destructive">
            {errText(why.error, "Couldn't work out the reasons.")}{" "}
            <button type="button" className="underline" onClick={() => void why.refetch()}>Try again</button>
          </p>
        ) : why.data ? (
          <div className="space-y-3">
            <ul className="mt-1 list-disc pl-5 text-sm">
              {why.data.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <div hidden={!why.data.staffId}>
              <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Who else, and what stops them</h5>
              {why.data.others.length === 0 ? (
                <p className="text-sm text-muted-foreground">There is nobody else on your staff list.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {why.data.others.map((o) => (
                    <li key={o.staffId}>
                      <strong>{o.name}</strong>{" "}
                      {o.allowed ? (
                        <span>
                          could have worked it
                          {o.wouldBreakSoft.length ? `, though it goes against a preference: ${o.wouldBreakSoft.join(" ")}` : "."}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">can't: {o.blockedBy.join(" ")}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
