import {
  actionErrorMessage,
  deleteClientAppState,
  useActionMutation,
  useActionQuery,
  useDbSync,
  writeClientAppState,
} from "@agent-native/core/client/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { TAB_ID } from "@/lib/tab-id";
import { cn } from "@/lib/utils";
import { Clip, RailBar, Zig } from "./art";
import { BuildPanel, FairnessStrip } from "./BuildPanel";
import { btnPrimary, btnSecondary, copyText, dayLabel, errText } from "./format";
import { PublishPanel } from "./PublishPanel";
import { RulesPanel } from "./RulesPanel";
import { SetupForm } from "./SetupForm";
import { ShiftPanel } from "./ShiftPanel";
import { Welcome } from "./Welcome";
import { DayList, WeekGrid } from "./WeekGrid";

type Notice = { kind: "error" | "ok"; text: string };
type Panel = "rules" | null;

function PreparedMessage({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <div className="rail-wrap" style={{ maxWidth: "34rem" }}>
      <RailBar />
      <div data-testid="prepared-message" className="ticket" style={{ marginBottom: "1.125rem" }}>
        <Clip className="ticket-clip" />
        <p className="font-medium">Message for your cover. Copy it and send it yourself; nothing is sent from here.</p>
        <textarea readOnly aria-label="Prepared message" className="field mt-2" rows={4} value={message} onFocus={(e) => e.currentTarget.select()} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" className={btnPrimary} onClick={async () => setState((await copyText(message)) ? "ok" : "fail")}>
            Copy message
          </button>
          <button type="button" className={btnSecondary} onClick={onDismiss}>Done</button>
          {state === "ok" ? <span role="status" className="hint">Copied.</span> : null}
          {state === "fail" ? <span role="alert" className="problem-line">Couldn't copy. Select the text and copy it yourself.</span> : null}
        </div>
        <Zig />
      </div>
    </div>
  );
}

function SheetSkeleton() {
  return (
    <div className="sheet" role="status" aria-label="Loading your week">
      <table className="rota" aria-hidden="true">
        <thead>
          <tr>
            {Array.from({ length: 8 }).map((_, i) => (
              <th key={i}>
                <div className="skeleton-cell" style={{ height: "1.25rem" }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 4 }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: 8 }).map((_, c) => (
                <td key={c} style={{ height: "4rem" }}>
                  {c > 0 && (r + c) % 3 === 0 ? <div className="skeleton-cell" /> : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type StepState = "done" | "current" | "todo";
function StepRail({
  steps,
  onPick,
}: {
  steps: { id: string; label: string; state: StepState; note: string }[];
  onPick: (id: string) => void;
}) {
  return (
    <nav aria-label="Steps" data-testid="steps">
      <ol className="steps">
        {steps.map((s) => (
          <li key={s.id} className="flex min-w-0 flex-1 basis-36">
            <button
              type="button"
              className="step w-full"
              aria-current={s.state === "current" ? "step" : undefined}
              onClick={() => onPick(s.id)}
            >
              <Clip className="step-clip" closed={s.state !== "todo"} height={20} />
              {s.label}
              <span className="step-state">{s.note}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Board() {
  const queryClient = useQueryClient();
  // The week can change without this user acting (the agent over MCP/A2A, a script, another
  // tab). Only this private route opts in to remote sync; everything else stays poll-free.
  useDbSync({
    queryClient,
    ignoreSource: TAB_ID,
    realtime: { reason: "the agent, another tab or a script can change the week while the board is open" },
    pauseWhenHidden: true,
  });
  const week = useActionQuery("get-week", {});
  const loadSample = useActionMutation("load-sample-week");
  const move = useActionMutation("move-shift");

  const [mode, setMode] = useState<"main" | "setup">("main");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "day">("grid");
  const [panel, setPanel] = useState<Panel>(null);
  const [panelInit, setPanelInit] = useState(false);
  const [dismissedChange, setDismissedChange] = useState<string | null>(null);
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Phones and narrow windows get the one-day-at-a-time list; the grid scrolls inside its own box.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setView(mq.matches ? "day" : "grid");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // The assistant is a real second hand on the board: say so while it runs.
  useEffect(() => {
    const onRun = (e: Event) => setAgentRunning(Boolean((e as CustomEvent<{ isRunning?: boolean }>).detail?.isRunning));
    window.addEventListener("agentNative.chatRunning", onRun);
    return () => window.removeEventListener("agentNative.chatRunning", onRun);
  }, []);

  const data = week.data;
  const selected = useMemo(() => data?.slots.find((s) => s.id === selectedId) ?? null, [data, selectedId]);
  const change = data?.lastChange ?? null;
  const changedIds = useMemo(
    () => new Set(change && change.at !== dismissedChange ? change.slotIds : []),
    [change, dismissedChange],
  );

  // The rules panel opens by itself while rules are the next thing to do.
  useEffect(() => {
    if (!data?.hasWeek || panelInit) return;
    setPanelInit(true);
    if (data.nextStep === "rules" || data.nextStep === "confirm") setPanel("rules");
  }, [data, panelInit]);

  // Tell the agent which shift is selected (context-awareness: tab-scoped `selection`).
  useEffect(() => {
    const key = `selection:${TAB_ID}`;
    if (selected) {
      void writeClientAppState(
        key,
        {
          kind: "shift",
          id: selected.id,
          slotId: selected.id,
          text: `${selected.description}${selected.staffName ? `, worked by ${selected.staffName}` : ", open"}${selected.locked ? " (locked)" : ""}`,
          staffId: selected.staffId,
        },
        { requestSource: TAB_ID },
      );
    } else {
      void deleteClientAppState(key, { requestSource: TAB_ID });
    }
  }, [selected]);
  useEffect(
    () => () => {
      void deleteClientAppState(`selection:${TAB_ID}`, { requestSource: TAB_ID, keepalive: true });
    },
    [],
  );

  function doMove(slotId: string, staffId: string, lock?: boolean) {
    setNotice(null);
    setPendingSlot(slotId);
    move.mutate(
      { slotId, staffId, ...(lock === undefined ? {} : { lock }) },
      {
        onSuccess: (r) => setNotice({ kind: "ok", text: r.message }),
        onError: (err) => setNotice({ kind: "error", text: errText(err, "Couldn't move that shift. Nothing was changed.") }),
        onSettled: () => setPendingSlot(null),
      },
    );
  }

  function goShare() {
    const el = document.getElementById("sec-share");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    el?.querySelector<HTMLElement>("button, a")?.focus({ preventScroll: true });
  }

  function focusBuild() {
    sheetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelector<HTMLElement>("[data-testid=build-week]")?.focus({ preventScroll: true });
  }

  if (week.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] space-y-4 p-3 sm:p-5">
        <div className="skeleton-cell" style={{ width: "14rem", height: "2rem" }} />
        <SheetSkeleton />
        <p className="hint" role="status">Loading your week...</p>
      </div>
    );
  }
  if (week.error) {
    return (
      <div className="p-6" role="alert">
        <p className="problem-line">Your week couldn't be loaded.</p>
        <p className="hint mt-1">{actionErrorMessage(week.error) ?? "Check your connection and try again."}</p>
        <button type="button" className={`${btnSecondary} mt-3`} onClick={() => void week.refetch()}>Try again</button>
      </div>
    );
  }

  if (!data || !data.hasWeek) {
    if (mode === "setup") {
      return <SetupForm existing={null} onCancel={() => setMode("main")} onDone={() => setMode("main")} />;
    }
    return (
      <Welcome
        loadingSample={loadSample.isPending}
        error={sampleError}
        onSetup={() => setMode("setup")}
        onSample={() => {
          setSampleError(null);
          loadSample.mutate({}, { onError: (err) => setSampleError(errText(err, "Couldn't load the sample restaurant.")) });
        }}
      />
    );
  }

  if (mode === "setup") {
    return (
      <SetupForm
        existing={data}
        onCancel={() => setMode("main")}
        onDone={() => {
          setMode("main");
          setSelectedId(null);
        }}
      />
    );
  }

  const proposedCount = data.rules.filter((r) => r.status === "proposed" && r.kind !== "note").length;
  const confirmedCount = data.rules.filter((r) => r.status === "confirmed" && r.kind !== "note").length;
  const placed = data.slots.some((s) => s.staffId);
  const hasCoverMessage = change?.kind === "cover" && change.message && dismissedMessage !== change.at;
  const ns = data.nextStep;
  const next: { text: string; button: string; run: () => void } | null = (
    {
      rules: { text: "Next: paste your staff's messages so ShiftAssist can find their rules.", button: "Open the messages panel", run: () => setPanel("rules") },
      confirm: { text: `Next: check ${proposedCount} rule${proposedCount === 1 ? "" : "s"} and confirm the ones that are right.`, button: "Check the rules", run: () => setPanel("rules") },
      build: { text: "Next: build the week.", button: "Go to Build week", run: focusBuild },
      publish: { text: "Next: publish the week so your staff can see it on their phones.", button: "Open Share", run: goShare },
      done: { text: "All set. If someone can't make a shift, click that shift and choose \"Someone can't make it\".", button: "", run: () => {} },
      setup: null,
    } as const
  )[ns];

  const steps: { id: string; label: string; state: StepState; note: string }[] = [
    { id: "staff", label: "Staff and shifts", state: "done", note: `${data.staff.length} people, ${data.slots.length} shifts` },
    {
      id: "rules",
      label: "Rules",
      state: ns === "rules" || ns === "confirm" ? "current" : confirmedCount > 0 ? "done" : "todo",
      note: proposedCount > 0 ? `${proposedCount} to check` : `${confirmedCount} in use`,
    },
    {
      id: "week",
      label: "Week",
      state: ns === "build" ? "current" : placed ? "done" : "todo",
      note: placed ? `${data.slots.filter((s) => s.staffId).length} of ${data.slots.length} filled` : "Not built yet",
    },
    {
      id: "share",
      label: "Share",
      state: ns === "publish" ? "current" : data.published ? "done" : "todo",
      note: data.published ? "Live" : "Not shared",
    },
  ];
  function pickStep(id: string) {
    if (id === "staff") setMode("setup");
    else if (id === "rules") setPanel((p) => (p === "rules" ? null : "rules"));
    else if (id === "share") goShare();
    else focusBuild();
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] space-y-4 p-3 sm:p-5" data-testid="week-page">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="display text-3xl leading-tight">{data.week?.name}</h1>
        {data.week?.isSample ? (
          <span className="mono border px-2" style={{ borderColor: "hsl(var(--rule-strong))" }}>Sample data</span>
        ) : null}
        <span className="hint">Week of <span className="mono">{dayLabel(data.week!.startDate)}</span></span>
        <button type="button" className="link ml-auto" onClick={() => setMode("setup")}>
          {data.week?.isSample ? "Set up my own restaurant" : "Edit staff and shifts"}
        </button>
      </div>

      <StepRail steps={steps} onPick={pickStep} />

      {next ? (
        <div role="status" data-testid="next-step" className="flex flex-wrap items-center gap-3">
          <span className="font-medium">{next.text}</span>
          {next.button ? (
            <button type="button" className={btnPrimary} onClick={next.run}>
              {next.button}
            </button>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          data-testid="board-notice"
          className="flex items-start justify-between gap-3 border-l-4 py-1 pl-3"
          style={{ borderColor: notice.kind === "error" ? "hsl(var(--problem))" : "hsl(var(--allowed))" }}
        >
          <span className={notice.kind === "error" ? "problem-line" : ""}>{notice.text}</span>
          <button type="button" className="link shrink-0" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      ) : null}

      {hasCoverMessage ? <PreparedMessage message={change!.message!} onDismiss={() => setDismissedMessage(change!.at)} /> : null}

      <div className={cn("grid gap-5", panel && "lg:grid-cols-[minmax(0,1fr)_25rem]")}>
        {panel ? (
          <aside aria-label="Staff messages and rules" className="side-panel order-first min-w-0 space-y-3 lg:order-last">
            <div className="flex items-center justify-between gap-2">
              <h2 className="section-title">Staff messages and rules</h2>
              <button type="button" className="link" onClick={() => setPanel(null)}>Close panel</button>
            </div>
            <RulesPanel week={data} />
          </aside>
        ) : null}

        <div className="min-w-0 space-y-5" ref={sheetRef}>
          <section aria-label="Week sheet" className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <BuildPanel week={data} onSelectSlot={(id) => setSelectedId(id)} />
              <div role="group" aria-label="Board view" className="flex border" style={{ borderColor: "hsl(var(--input))" }}>
                <button type="button" aria-pressed={view === "grid"} className={cn("min-h-11 px-3 text-[0.9375rem] sm:min-h-9", view === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-accent")} onClick={() => setView("grid")}>Week sheet</button>
                <button type="button" aria-pressed={view === "day"} className={cn("min-h-11 px-3 text-[0.9375rem] sm:min-h-9", view === "day" ? "bg-primary text-primary-foreground" : "hover:bg-accent")} onClick={() => setView("day")}>By day</button>
              </div>
            </div>
            {agentRunning ? (
              <div role="status" data-testid="agent-strip">
                <div className="agent-strip" />
                <p className="hint mt-1">Your assistant is working. The sheet updates here when it changes something.</p>
              </div>
            ) : null}
            {changedIds.size > 0 && change ? (
              <div data-testid="change-banner" className="flex flex-wrap items-center justify-between gap-2 border-l-4 py-1 pl-3" style={{ borderColor: "hsl(var(--changed))" }}>
                <span>
                  <strong>{changedIds.size} shift{changedIds.size === 1 ? "" : "s"} changed</strong> and marked in yellow. {change.summary}
                </span>
                <button type="button" className="link" onClick={() => setDismissedChange(change.at)}>Clear marks</button>
              </div>
            ) : null}
            {view === "grid" ? (
              <WeekGrid
                week={data}
                selectedId={selectedId}
                changedIds={changedIds}
                pendingSlot={pendingSlot}
                onSelect={setSelectedId}
                onDropTo={(slotId, staffId) => doMove(slotId, staffId)}
              />
            ) : (
              <DayList week={data} selectedId={selectedId} changedIds={changedIds} pendingSlot={pendingSlot} onSelect={setSelectedId} />
            )}
            <p className="hint">
              Click a shift to print its receipt. Drag it onto another person's row; allowed cells get a green outline and blocked ones are hatched with the reason. Or use "Move to..." on the receipt.
            </p>
          </section>

          {selected ? (
            <ShiftPanel
              key={selected.id}
              slot={selected}
              week={data}
              moving={move.isPending}
              onClose={() => setSelectedId(null)}
              onMove={(staffId, lock) => doMove(selected.id, staffId, lock)}
              onNotice={setNotice}
            />
          ) : (
            <p className="hint" data-testid="selected-shift">
              Click a shift to see why that person has it, lock it, move it, or cover it. Your assistant can see which one you picked.
            </p>
          )}

          {data.fairness ? <FairnessStrip fairness={data.fairness} /> : null}

          <section aria-label="Share with your staff" id="sec-share" className="space-y-2">
            <h2 className="section-title">Share with your staff</h2>
            <PublishPanel week={data} />
          </section>
        </div>
      </div>
    </div>
  );
}
