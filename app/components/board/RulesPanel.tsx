import { useActionMutation } from "@agent-native/core/client/hooks";
import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import { useEffect, useRef, useState } from "react";

import type { WeekView } from "../../../server/lib/week-view";
import { btnDanger, btnPrimary, btnSecondary, errText, inputCls } from "./format";

type Card = WeekView["rules"][number];

export const MAX_PASTE = 5000;
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_LABELS: [string, number][] = [
  ["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6], ["Sun", 0],
];

function Badge({ severity }: { severity: "hard" | "soft" }) {
  return (
    <span
      className={
        severity === "hard"
          ? "rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-900 dark:bg-red-950 dark:text-red-200"
          : "rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-900 dark:bg-sky-950 dark:text-sky-200"
      }
    >
      {severity === "hard" ? "Must" : "Preference"}
    </span>
  );
}

function PasteBox({ week }: { week: WeekView }) {
  const [text, setText] = useState("");
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [slow, setSlow] = useState(false);
  const proposedNow = week.rules.filter((r) => r.status === "proposed").length;
  const baseline = useRef(0);

  // "Reading" ends when new proposed cards show up; after a minute point the manager at the chat.
  useEffect(() => {
    if (sentAt === null) return;
    if (proposedNow > baseline.current) {
      setSentAt(null);
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), 60000);
    return () => window.clearTimeout(t);
  }, [sentAt, proposedNow]);

  function send() {
    const body = text.trim();
    if (!body) return;
    baseline.current = proposedNow;
    sendToAgentChat({
      message:
        `Here are my staff's messages for the week starting ${week.week?.startDate}. ` +
        `Read them and use propose-rules to store each rule as a proposed card with the original sentence as the source. ` +
        `Do not confirm anything. If a message is unclear or names someone who is not on staff, say so.\n\n` +
        `--- staff messages ---\n${body}\n--- end ---`,
      submit: true,
      openSidebar: true,
      newTab: true,
    });
    setSentAt(Date.now());
    setSlow(false);
  }

  return (
    <div className="space-y-2">
      <label htmlFor="paste-box" className="block text-sm font-medium">
        Paste staff messages
      </label>
      <textarea
        id="paste-box"
        data-testid="paste-box"
        className={`${inputCls} min-h-28`}
        maxLength={MAX_PASTE}
        placeholder={"Paste texts or notes from your staff, one after another.\nFor example: \"Maya: can't do Fridays, school pickup\""}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnPrimary} disabled={!text.trim() || sentAt !== null} onClick={send}>
          {sentAt !== null ? "Your assistant is reading..." : "Read these messages"}
        </button>
        {week.exampleMessages ? (
          <button type="button" className={btnSecondary} onClick={() => setText(week.exampleMessages ?? "")}>
            Use the example messages
          </button>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {text.length}/{MAX_PASTE}
        </span>
      </div>
      {sentAt !== null ? (
        <p role="status" className="text-sm text-muted-foreground">
          Sent to your assistant in the chat panel. Rule cards will appear here for you to check; nothing is used until you confirm it.
          {slow ? " This is taking a while. Check the chat to see what the assistant says." : ""}
        </p>
      ) : null}
    </div>
  );
}

function blankEditor(card: Card | null, week: WeekView) {
  const d = (card?.details ?? {}) as {
    weekdays?: number[];
    from?: string;
    until?: string;
    afterTime?: string;
    beforeTime?: string;
    max?: number;
    hours?: number;
  };
  return {
    staffId: card?.staffId ?? "",
    kind: (card && card.kind !== "unclear" ? card.kind : "unavailable") as "unavailable" | "no_double" | "max_shifts" | "min_rest",
    severity: (card?.severity ?? "hard") as "hard" | "soft",
    days: (d.weekdays ?? []) as number[],
    from: d.from ?? "",
    until: d.until ?? "",
    afterTime: d.afterTime ?? "",
    beforeTime: d.beforeTime ?? "",
    max: d.max !== undefined ? String(d.max) : "4",
    hours: d.hours !== undefined ? String(d.hours) : "10",
    source: card?.source ?? "",
  };
}

function RuleEditor({ card, week, onClose }: { card: Card | null; week: WeekView; onClose: () => void }) {
  const [f, setF] = useState(() => blankEditor(card, week));
  const [problem, setProblem] = useState<string | null>(null);
  const save = useActionMutation("save-rule");
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setProblem(null);
    if (!f.staffId) return setProblem("Choose who this rule is for.");
    save.mutate(
      {
        ...(card ? { id: card.id } : {}),
        staffId: f.staffId,
        kind: f.kind,
        severity: f.severity,
        ...(f.kind === "unavailable"
          ? {
              ...(f.days.length ? { days: f.days.map((n) => DAY_KEYS[n]!) } : {}),
              ...(f.from ? { from: f.from } : {}),
              ...(f.until ? { until: f.until } : {}),
              ...(f.afterTime ? { afterTime: f.afterTime } : {}),
              ...(f.beforeTime ? { beforeTime: f.beforeTime } : {}),
            }
          : {}),
        ...(f.kind === "max_shifts" ? { max: Number(f.max) } : {}),
        ...(f.kind === "min_rest" ? { hours: Number(f.hours) } : {}),
        ...(f.source.trim() ? { source: f.source.trim() } : {}),
      },
      { onSuccess: onClose, onError: (err) => setProblem(errText(err, "Couldn't save that rule.")) },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border bg-muted/30 p-3" aria-label={card ? "Edit rule" : "Add a rule"}>
      <h3 className="text-sm font-medium">{card ? "Edit this rule" : "Add a rule by hand"}</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs">
          Who
          <select className={inputCls} value={f.staffId} onChange={(e) => set("staffId", e.target.value)} aria-label="Who is this rule for">
            {!card?.staffId ? <option value="">Choose a person...</option> : null}
            {week.staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          What
          <select className={inputCls} value={f.kind} onChange={(e) => set("kind", e.target.value as typeof f.kind)} aria-label="Kind of rule">
            <option value="unavailable">Can't work certain days or times</option>
            <option value="no_double">At most one shift a day</option>
            <option value="max_shifts">At most N shifts this week</option>
            <option value="min_rest">Rest between shifts</option>
          </select>
        </label>
        <label className="text-xs">
          How strict
          <select className={inputCls} value={f.severity} onChange={(e) => set("severity", e.target.value as "hard" | "soft")} aria-label="How strict">
            <option value="hard">Must (never broken)</option>
            <option value="soft">Preference (avoid if possible)</option>
          </select>
        </label>
      </div>
      {f.kind === "unavailable" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map(([label, n]) => (
              <label key={n} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={f.days.includes(n)}
                  onChange={(e) => set("days", e.target.checked ? [...f.days, n] : f.days.filter((x) => x !== n))}
                  aria-label={`Every ${label}`}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="text-xs">From date<input type="date" className={inputCls} value={f.from} onChange={(e) => set("from", e.target.value)} /></label>
            <label className="text-xs">Until date<input type="date" className={inputCls} value={f.until} onChange={(e) => set("until", e.target.value)} /></label>
            <label className="text-xs">Not after<input type="time" className={inputCls} value={f.afterTime} onChange={(e) => set("afterTime", e.target.value)} /></label>
            <label className="text-xs">Not before<input type="time" className={inputCls} value={f.beforeTime} onChange={(e) => set("beforeTime", e.target.value)} /></label>
          </div>
          <p className="text-xs text-muted-foreground">Leave days and dates empty to apply to every day. For a single day, set the same date in both date boxes.</p>
        </div>
      ) : null}
      {f.kind === "max_shifts" ? (
        <label className="block text-xs">Most shifts this week<input className={`${inputCls} max-w-32`} inputMode="numeric" value={f.max} onChange={(e) => set("max", e.target.value)} /></label>
      ) : null}
      {f.kind === "min_rest" ? (
        <label className="block text-xs">Least hours between shifts<input className={`${inputCls} max-w-32`} inputMode="numeric" value={f.hours} onChange={(e) => set("hours", e.target.value)} /></label>
      ) : null}
      <label className="block text-xs">
        Note (optional)
        <input className={inputCls} value={f.source} maxLength={500} onChange={(e) => set("source", e.target.value)} />
      </label>
      {problem ? <p role="alert" className="text-sm text-destructive">{problem}</p> : null}
      <div className="flex gap-2">
        <button type="submit" className={btnPrimary} disabled={save.isPending}>
          {save.isPending ? "Saving..." : card?.status === "proposed" ? "Save and confirm" : "Save rule"}
        </button>
        <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

function RuleCardView({
  card,
  week,
  onError,
}: {
  card: Card;
  week: WeekView;
  onError: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const confirm = useActionMutation("confirm-rules");
  const del = useActionMutation("delete-rule");
  const proposed = card.status === "proposed";
  const needsAttention = Boolean(card.flag) || !card.staffId;

  if (editing) return <RuleEditor card={card} week={week} onClose={() => setEditing(false)} />;
  return (
    <li
      data-testid={proposed ? "rule-card-proposed" : "rule-card-confirmed"}
      className={`rounded-lg border p-3 ${needsAttention ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge severity={card.severity} />
        {proposed ? <span className="text-xs text-muted-foreground">Waiting for you</span> : <span className="text-xs text-muted-foreground">In use</span>}
        {needsAttention ? <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium text-amber-950">Needs a person</span> : null}
      </div>
      <p className="mt-1 text-sm font-medium">{card.text}</p>
      {card.source ? <p className="mt-1 text-xs text-muted-foreground">They wrote: "{card.source}"</p> : null}
      {card.flag ? <p className="mt-1 text-xs text-amber-900 dark:text-amber-200">{card.flag}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {proposed ? (
          <button
            type="button"
            className={btnPrimary}
            disabled={confirm.isPending || needsAttention}
            title={needsAttention ? "Edit this card first" : undefined}
            onClick={() =>
              confirm.mutate({ ids: [card.id] }, { onError: (err) => onError(errText(err, "Couldn't confirm that rule.")) })
            }
          >
            {confirm.isPending ? "Confirming..." : "Confirm"}
          </button>
        ) : null}
        <button type="button" className={btnSecondary} onClick={() => setEditing(true)}>
          {needsAttention ? "Fix this card" : "Edit"}
        </button>
        <button
          type="button"
          className={btnDanger}
          disabled={del.isPending}
          onClick={() => del.mutate({ id: card.id }, { onError: (err) => onError(errText(err, "Couldn't delete that rule.")) })}
        >
          {del.isPending ? "Deleting..." : "Delete"}
        </button>
      </div>
    </li>
  );
}

export function RulesPanel({ week }: { week: WeekView }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmed, setShowConfirmed] = useState(false);
  const confirmAll = useActionMutation("confirm-rules");
  const proposed = week.rules.filter((r) => r.status === "proposed");
  const confirmed = week.rules.filter((r) => r.status === "confirmed");
  const ready = proposed.filter((r) => !r.flag && r.staffId);

  return (
    <div className="space-y-4">
      <PasteBox week={week} />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          <button type="button" className="underline" onClick={() => setError(null)}>Dismiss</button>
        </p>
      ) : null}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Rules to check ({proposed.length})</h3>
          {ready.length > 0 ? (
            <button
              type="button"
              className={btnPrimary}
              disabled={confirmAll.isPending}
              onClick={() =>
                confirmAll.mutate({ all: true }, { onError: (err) => setError(errText(err, "Couldn't confirm the rules.")) })
              }
            >
              {confirmAll.isPending ? "Confirming..." : `Confirm all (${ready.length})`}
            </button>
          ) : null}
        </div>
        {proposed.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing waiting. Paste messages above and the rules your assistant finds will show up here for you to confirm.
          </p>
        ) : (
          <ul className="mt-2 space-y-2" aria-label="Proposed rules">
            {proposed.map((c) => (
              <RuleCardView key={c.id} card={c} week={week} onError={setError} />
            ))}
          </ul>
        )}
      </div>

      <div>
        <button type="button" className="text-sm underline" onClick={() => setShowConfirmed((v) => !v)} aria-expanded={showConfirmed}>
          {showConfirmed ? "Hide" : "Show"} rules in use ({confirmed.length})
        </button>
        {showConfirmed ? (
          confirmed.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No confirmed rules yet. The week will be built with only the basic limits.</p>
          ) : (
            <ul className="mt-2 space-y-2" aria-label="Confirmed rules">
              {confirmed.map((c) => (
                <RuleCardView key={c.id} card={c} week={week} onError={setError} />
              ))}
            </ul>
          )
        ) : null}
      </div>

      {adding ? (
        <RuleEditor card={null} week={week} onClose={() => setAdding(false)} />
      ) : (
        <button type="button" className={btnSecondary} onClick={() => setAdding(true)}>
          Add a rule by hand
        </button>
      )}
    </div>
  );
}
