import { useActionMutation, useActionQuery } from "@agent-native/core/client/hooks";
import { sendToAgentChatAndConfirm } from "@agent-native/core/client/agent-chat";
import { useEffect, useState } from "react";

import type { WeekView } from "../../../server/lib/week-view";
import { Clip, Strike, Zig } from "./art";
import { btnDanger, btnPrimary, btnSecondary, dayLabel, errText, shapeReason } from "./format";

type Slot = WeekView["slots"][number];

/** Sick day: the engine's ranked cover options, each one a ticket. Choosing one moves the slip. */
export function CoverFlow({ slot, onClose, onNotice }: { slot: Slot; onClose: () => void; onNotice: (n: { kind: "ok" | "error"; text: string }) => void }) {
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

  if (cover.isLoading) return <p role="status" className="hint">Looking for cover...</p>;
  if (cover.error) {
    return (
      <p role="alert" className="text-sm" style={{ color: "hsl(var(--problem))" }}>
        {errText(cover.error, "Couldn't look for cover.")}{" "}
        <button type="button" className="link" onClick={() => void cover.refetch()}>Try again</button>
      </p>
    );
  }
  const data = cover.data!;
  return (
    <div className="space-y-3" data-testid="cover-flow">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title">{data.absentName} can't make it. Who can cover?</h3>
        <button type="button" className="link" onClick={onClose}>Cancel</button>
      </div>
      {data.options.length === 0 ? (
        <div className="ticket" data-attention="true">
          <p className="problem-line">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="mt-0.5 shrink-0"><path d="M9 2 17 16H1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M9 7v4.5M9 13.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            Nobody can cover this shift.
          </p>
          <ul className="mt-2 space-y-1 text-[0.9375rem]">
            {data.blocked.map((b) => (
              <li key={b.staffId}>
                <strong>{b.name}:</strong> {b.blockedBy.join(" ") || "Not available."}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <button type="button" className={btnDanger} disabled={apply.isPending} onClick={() => choose(undefined, null)}>
              {apply.isPending ? "Saving..." : `Mark ${data.absentName} off and leave the shift open`}
            </button>
          </div>
          <Zig />
        </div>
      ) : (
        <ol className="space-y-1" aria-label="Cover options, best first">
          {data.options.map((o, i) => (
            <li key={o.staffId} className="ticket ticket-enter" style={{ ["--i" as string]: i }} data-testid="cover-option">
              <Clip className="ticket-clip" />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="display text-lg">
                  <span className="ticket-no">{i + 1}</span> {o.name}
                </span>
                <span>overtime cost <span className="mono">{o.overtimeCost}</span></span>
              </div>
              <ul className="mt-1 list-disc pl-5 text-[0.9375rem]">
                {o.reasons.map((r, k) => (
                  <li key={k}>{r}</li>
                ))}
              </ul>
              <div className="mt-2">
                <button type="button" className={i === 0 ? btnPrimary : btnSecondary} disabled={apply.isPending} onClick={() => choose(o.staffId, o.name)}>
                  {apply.isPending ? "Saving..." : `Choose ${o.name}`}
                </button>
              </div>
              <Zig />
            </li>
          ))}
        </ol>
      )}
      {data.options.length > 0 ? (
        <p className="hint">Choosing someone changes the rota and marks {data.absentName} off that day. Nothing is sent to anyone.</p>
      ) : null}
      {error ? <p role="alert" className="text-sm" style={{ color: "hsl(var(--problem))" }}>{error}</p> : null}
    </div>
  );
}

export function ShiftPanel({
  slot,
  week,
  onMove,
  moving,
  onCover,
}: {
  slot: Slot;
  week: WeekView;
  onMove: (staffId: string, lock?: boolean) => void;
  moving: boolean;
  onCover: () => void;
}) {
  const why = useActionQuery("explain-shift", { slotId: slot.id });

  const [askState, setAskState] = useState<"idle" | "queued" | "sent" | "failed">("idle");

  async function deliverWhy(summary: string) {
    const opts = {
      message: `Explain in plain words, in two or three short sentences, why ${slot.staffName ?? "nobody"} has the ${slot.description} shift. Use only the engine's reasons in the context. Do not invent reasons.`,
      context: summary,
      contextLabel: `Why: ${slot.description}`,
      chatTarget: "local" as const,
      submit: true,
      openSidebar: true,
    };
    try {
      const r = await sendToAgentChatAndConfirm(opts);
      setAskState(r.delivered ? "sent" : "failed");
    } catch {
      setAskState("failed");
    }
  }

  // The click is never dead: if the reasons are not here yet, queue it and send when they arrive.
  useEffect(() => {
    if (askState !== "queued") return;
    if (why.data) void deliverWhy(why.data.summary);
    else if (why.error) setAskState("failed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askState, why.data]);

  function askWhy() {
    setAskState("queued");
  }

  const mine = week.fairness?.people.find((p) => p.staffId === slot.staffId);
  const avg = week.fairness?.averages.shifts;
  const others = why.data?.others ?? [];
  const couldWork = others.filter((o) => o.allowed);
  const cannot = others.filter((o) => !o.allowed);

  return (
    <>
      <div className="drawer-body" data-testid="shift-panel">
        <div className="receipt" data-testid="why-panel">
          <p className="receipt-kicker">
            {slot.label}, {dayLabel(slot.date)}, {slot.start}-{slot.end}
          </p>
          <h3 className="receipt-lead">
            {slot.staffId ? `${slot.staffName} has this shift${slot.locked ? " (locked)" : ""} because` : "This shift is open because"}
          </h3>
          {why.isLoading ? (
            <p role="status" className="hint">Checking the rules...</p>
          ) : why.error ? (
            <p role="alert" className="problem-line">
              {errText(why.error, "Couldn't work out the reasons.")}{" "}
              <button type="button" className="link" onClick={() => void why.refetch()}>Try again</button>
            </p>
          ) : why.data ? (
            <>
              <ul className="receipt-reasons">
                {why.data.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              {mine && avg !== undefined ? (
                <p className="receipt-count">
                  {mine.name}: {mine.shifts} shifts, team average {avg.toFixed(1)}
                </p>
              ) : null}
              <div hidden={!why.data.staffId} className="who-else">
                <h4>Who else</h4>
                {others.length === 0 ? (
                  <p className="hint">There is nobody else on your staff list.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {couldWork.map((o) => (
                      <li key={o.staffId} className="could" data-testid="could-work">
                        <span>
                          <strong>{o.name}</strong> could have worked it
                          {o.wouldBreakSoft.length ? `, though it goes against a preference: ${o.wouldBreakSoft.join(" ")}` : "."}
                        </span>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={moving} onClick={() => onMove(o.staffId)}>
                          Move here
                        </button>
                      </li>
                    ))}
                    {cannot.map((o) => {
                      const shaped = o.blockedBy.map((b) => shapeReason(o.name, b));
                      const allShort = shaped.length > 0 && shaped.every((x) => !x.exact);
                      return (
                        <li key={o.staffId} className="cannot">
                          {allShort ? (
                            <>
                              <span className="struck">{o.name}<Strike /></span>: {shaped.map((x) => x.text).join("; ")}
                            </>
                          ) : (
                            <>
                              <span className="struck">{o.name}<Strike /></span> {o.blockedBy.length ? o.blockedBy.map((b, i) => (i > 0 ? b : b.startsWith(o.name) ? b.slice(o.name.length) : `: ${b}`) + (i < o.blockedBy.length - 1 ? " " : "")).join("") : ": not available."}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : null}
          <Zig />
        </div>
      </div>

      <div className="drawer-foot">
        <div className="flex flex-wrap items-end gap-2">
          <label className="field-label">
            Move to...
            <select
              className="field mt-1 block min-w-40"
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
        </div>
        <div className="flex flex-wrap gap-2">
          {slot.staffId ? (
            <button type="button" className={btnSecondary} onClick={onCover}>
              Someone can't make it
            </button>
          ) : null}
          <button type="button" className={btnSecondary} onClick={askWhy} disabled={askState === "queued"} title="Your assistant explains it in plain words">
            {askState === "queued" ? "Asking..." : "Ask the assistant why"}
          </button>
        </div>
        {askState === "sent" ? <p role="status" className="hint">Sent to your assistant. Its answer is in the chat panel.</p> : null}
        {askState === "failed" ? <p role="alert" className="problem-line">Your assistant didn't take that. Try Ask why again; the reasons above are still right.</p> : null}
      </div>
    </>
  );
}
