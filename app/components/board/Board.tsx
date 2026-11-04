import {
  actionErrorMessage,
  deleteClientAppState,
  useActionMutation,
  useActionQuery,
  useDbSync,
  writeClientAppState,
} from "@agent-native/core/client/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { TAB_ID } from "@/lib/tab-id";
import { cn } from "@/lib/utils";
import { BuildPanel } from "./BuildPanel";
import { btnSecondary, copyText, dayLabel, errText } from "./format";
import { PublishPanel } from "./PublishPanel";
import { RulesPanel } from "./RulesPanel";
import { SetupForm } from "./SetupForm";
import { ShiftPanel } from "./ShiftPanel";
import { Welcome } from "./Welcome";
import { DayList, WeekGrid } from "./WeekGrid";

type Notice = { kind: "error" | "ok"; text: string };

function Section({ id, step, title, children }: { id: string; step: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-4 space-y-3 rounded-xl border p-3 sm:p-4">
      <h2 id={`${id}-h`} className="text-base font-semibold">
        <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function PreparedMessage({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <div data-testid="prepared-message" className="space-y-2 rounded-lg border border-primary p-3">
      <p className="text-sm font-medium">Message for your cover (copy it and send it yourself; nothing is sent from here)</p>
      <textarea readOnly aria-label="Prepared message" className="w-full rounded-md border bg-muted/40 p-2 text-sm" rows={4} value={message} onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          onClick={async () => setState((await copyText(message)) ? "ok" : "fail")}
        >
          Copy message
        </button>
        <button type="button" className={btnSecondary} onClick={onDismiss}>Done</button>
        {state === "ok" ? <span role="status" className="text-sm text-muted-foreground">Copied.</span> : null}
        {state === "fail" ? <span role="alert" className="text-sm text-destructive">Couldn't copy. Select the text and copy it yourself.</span> : null}
      </div>
    </div>
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
  const [dismissedChange, setDismissedChange] = useState<string | null>(null);
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  // Phones and narrow windows get the one-day-at-a-time list; the grid scrolls inside its own box.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setView(mq.matches ? "day" : "grid");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const data = week.data;
  const selected = useMemo(() => data?.slots.find((s) => s.id === selectedId) ?? null, [data, selectedId]);
  const change = data?.lastChange ?? null;
  const changedIds = useMemo(
    () => new Set(change && change.at !== dismissedChange ? change.slotIds : []),
    [change, dismissedChange],
  );

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

  function goTo(id: string) {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    const focusable = el?.querySelector<HTMLElement>("textarea, button, input, select");
    focusable?.focus({ preventScroll: true });
  }

  if (week.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground" role="status">Loading your week...</div>;
  }
  if (week.error) {
    return (
      <div className="p-6" role="alert">
        <p className="text-sm font-medium">Your week couldn't be loaded.</p>
        <p className="text-sm text-muted-foreground">{actionErrorMessage(week.error) ?? "Check your connection and try again."}</p>
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

  const proposedCount = data.rules.filter((r) => r.status === "proposed").length;
  const hasCoverMessage = change?.kind === "cover" && change.message && dismissedMessage !== change.at;
  const next = {
    rules: { text: "Next: paste your staff's messages so ShiftAssist can find their rules.", button: "Go to messages", target: "sec-rules" },
    confirm: { text: `Next: check ${proposedCount} rule${proposedCount === 1 ? "" : "s"} and confirm the ones that are right.`, button: "Go to the rules", target: "sec-rules" },
    build: { text: "Next: build the week.", button: "Go to Build week", target: "sec-week" },
    publish: { text: "Next: publish the week so your staff can see it on their phones.", button: "Go to Publish", target: "sec-share" },
    done: { text: "All set. If someone can't make a shift, click that shift and choose \"Someone can't make it\".", button: "", target: "" },
    setup: { text: "", button: "", target: "" },
  }[data.nextStep];

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-4 p-3 sm:p-4" data-testid="week-page">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-lg font-semibold">{data.week?.name}</h1>
        {data.week?.isSample ? <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950">SAMPLE data</span> : null}
        <span className="text-xs text-muted-foreground">Week of {dayLabel(data.week!.startDate)}</span>
        <button type="button" className="ml-auto text-sm underline" onClick={() => setMode("setup")}>
          {data.week?.isSample ? "Set up my own restaurant" : "Edit staff and shifts"}
        </button>
      </div>

      {next.text ? (
        <div role="status" data-testid="next-step" className="flex flex-wrap items-center gap-3 rounded-lg bg-primary/10 px-3 py-2 text-sm">
          <span className="font-medium">{next.text}</span>
          {next.button ? (
            <button type="button" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground" onClick={() => goTo(next.target)}>
              {next.button}
            </button>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          data-testid="board-notice"
          className={cn(
            "flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm",
            notice.kind === "error" ? "border-destructive text-destructive" : "text-foreground",
          )}
        >
          <span>{notice.text}</span>
          <button type="button" className="shrink-0 text-xs underline" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      ) : null}

      {hasCoverMessage ? <PreparedMessage message={change!.message!} onDismiss={() => setDismissedMessage(change!.at)} /> : null}

      <Section id="sec-rules" step={1} title="Staff messages and rules">
        <RulesPanel week={data} />
      </Section>

      <Section id="sec-week" step={2} title="Build and adjust the week">
        <BuildPanel week={data} onSelectSlot={(id) => setSelectedId(id)} />
        {changedIds.size > 0 && change ? (
          <div data-testid="change-banner" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500 bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/40">
            <span>
              <strong>{changedIds.size} shift{changedIds.size === 1 ? "" : "s"} changed</strong> and highlighted below. {change.summary}
            </span>
            <button type="button" className="text-xs underline" onClick={() => setDismissedChange(change.at)}>Clear highlights</button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Click a shift to see why. Drag it onto another person, or use "Move to..." in the shift details.
          </p>
          <div role="group" aria-label="Board view" className="flex overflow-hidden rounded-md border text-sm">
            <button type="button" aria-pressed={view === "grid"} className={cn("px-3 py-1", view === "grid" && "bg-primary text-primary-foreground")} onClick={() => setView("grid")}>Week grid</button>
            <button type="button" aria-pressed={view === "day"} className={cn("px-3 py-1", view === "day" && "bg-primary text-primary-foreground")} onClick={() => setView("day")}>By day</button>
          </div>
        </div>
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
          <p className="rounded-lg border p-3 text-sm text-muted-foreground" data-testid="selected-shift">
            Click a shift to see why that person has it, lock it, move it, or cover it. Your assistant can see which one you picked.
          </p>
        )}
      </Section>

      <Section id="sec-share" step={3} title="Share with your staff">
        <PublishPanel week={data} />
      </Section>
    </div>
  );
}
