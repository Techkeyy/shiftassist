import {
  actionErrorMessage,
  deleteClientAppState,
  useActionMutation,
  useActionQuery,
  useDbSync,
  writeClientAppState,
} from "@agent-native/core/client/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { BuildResult } from "../../../server/lib/assignments";
import { TAB_ID } from "@/lib/tab-id";
import { Clip, Zig } from "./art";
import { BuildControl, BuildResultLine } from "./BuildPanel";
import { btnPrimary, btnSecondary, cleanWeekName, copyText, dayLabel, errText } from "./format";
import { PublishPanel } from "./PublishPanel";
import { RulesPanel } from "./RulesPanel";
import { SetupForm } from "./SetupForm";
import { CoverFlow, ShiftPanel } from "./ShiftPanel";
import { TopBar, type Step, type StepState } from "./TopBar";
import { Welcome } from "./Welcome";
import { DayList, TallyList, WeekGrid } from "./WeekGrid";

type Notice = { kind: "error" | "ok"; text: string };
type DrawerKind = "receipt" | "cover" | "rules" | "share" | "tally" | "message";

function useMq(query: string, initial = false) {
  const [match, setMatch] = useState(initial);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setMatch(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return match;
}

function PreparedMessage({ message, onDone }: { message: string; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <div data-testid="prepared-message" className="ticket" style={{ marginBottom: "1.125rem" }}>
      <Clip className="ticket-clip" />
      <p className="font-medium">Message for your cover. Copy it and send it yourself; nothing is sent from here.</p>
      <textarea readOnly aria-label="Prepared message" className="field mt-2 receipt-text" rows={5} value={message} onFocus={(e) => e.currentTarget.select()} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={btnPrimary} onClick={async () => setState((await copyText(message)) ? "ok" : "fail")}>
          Copy message
        </button>
        <button type="button" className={btnSecondary} onClick={onDone}>Done</button>
        {state === "ok" ? <span role="status" className="hint">Copied.</span> : null}
        {state === "fail" ? <span role="alert" className="problem-line">Couldn't copy. Select the text and copy it yourself.</span> : null}
      </div>
      <Zig />
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

/** One right-hand drawer. Escape closes it; focus moves in on open and the caller restores it on close. */
function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const headRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    headRef.current?.focus({ preventScroll: true });
  }, [title]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [onClose]);
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer side-panel" role="dialog" aria-modal="false" aria-label={title} data-testid="drawer">
        <div className="drawer-head">
          <h2 className="section-title" tabIndex={-1} ref={headRef}>{title}</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} aria-label={`Close ${title}`}>
            Close
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}

/** Small popover: how the tally marks are counted. */
function CountedNote({ closes, weekends }: { closes: number; weekends: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const on = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", on);
    return () => document.removeEventListener("pointerdown", on);
  }, [open]);
  return (
    <div
      className="popover-wrap"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button type="button" className="link" aria-expanded={open} aria-controls="counted-note" onClick={() => setOpen((v) => !v)}>
        How this is counted
      </button>
      {open ? (
        <div id="counted-note" className="popover" role="region" aria-label="How this is counted">
          <p>A close is a shift that ends at 22:00 or later. A weekend shift is one on Saturday or Sunday.</p>
          <p>Each mark is one shift; a slash through four makes five. The triangle under the line is the team average ({closes.toFixed(1)} closes, {weekends.toFixed(1)} weekend shifts). "Above avg" means at least one whole shift more than that average.</p>
          <p>The figures come from the scheduling engine and update as you move shifts.</p>
        </div>
      ) : null}
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
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);
  const [rulesSeen, setRulesSeen] = useState(false);
  const [panelInit, setPanelInit] = useState(false);
  const [dismissedChange, setDismissedChange] = useState<string | null>(null);
  // Remembered per browser so a reload does not pop the same cover message open again.
  const [dismissedMessage, setDismissedMessageState] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem("sa-dismissed-cover");
    } catch {
      return null;
    }
  });
  const setDismissedMessage = (at: string | null) => {
    setDismissedMessageState(at);
    try {
      if (at) window.localStorage.setItem("sa-dismissed-cover", at);
    } catch {
      /* private mode: fine */
    }
  };
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const messageShown = useRef<string | null>(null);

  // Phones and narrow windows get the by-day list; the full sheet needs the room.
  const narrow = useMq("(max-width: 1023px)");
  const touch = useMq("(pointer: coarse)");

  // The assistant is a real second hand on the board: say so while it runs.
  useEffect(() => {
    const onRun = (e: Event) => setAgentRunning(Boolean((e as CustomEvent<{ isRunning?: boolean }>).detail?.isRunning));
    window.addEventListener("agentNative.chatRunning", onRun);
    return () => window.removeEventListener("agentNative.chatRunning", onRun);
  }, []);

  const data = week.data;
  const selected = useMemo(() => data?.slots.find((s) => s.id === selectedId) ?? null, [data, selectedId]);
  const change = data?.lastChange ?? null;
  // A rebuilt week is not a wall of yellow: only moves and repairs are marked on the slips.
  const changedIds = useMemo(
    () => new Set(change && change.kind !== "build" && change.at !== dismissedChange ? change.slotIds : []),
    [change, dismissedChange],
  );

  const openDrawer = useCallback((kind: DrawerKind) => {
    setDrawer((cur) => {
      if (cur === null) opener.current = document.activeElement as HTMLElement | null;
      return kind;
    });
    if (kind === "rules") setRulesSeen(true);
    if (kind !== "receipt" && kind !== "cover") setSelectedId(null);
  }, []);

  const closeDrawer = useCallback(() => {
    const id = selectedId;
    setDrawer(null);
    setSelectedId(null);
    window.setTimeout(() => {
      const el = opener.current;
      if (el && el.isConnected) el.focus({ preventScroll: true });
      else if (id) document.querySelector<HTMLElement>(`[data-slot-id="${id}"]`)?.focus({ preventScroll: true });
      opener.current = null;
    }, 0);
  }, [selectedId]);

  const selectShift = useCallback(
    (id: string | null) => {
      if (!id) {
        closeDrawer();
        return;
      }
      setDrawer((cur) => {
        if (cur === null) opener.current = document.activeElement as HTMLElement | null;
        return "receipt";
      });
      setSelectedId(id);
    },
    [closeDrawer],
  );

  // The rules drawer opens by itself while rules are the next thing to do.
  useEffect(() => {
    if (!data?.hasWeek || panelInit) return;
    setPanelInit(true);
    if (data.nextStep === "rules" || data.nextStep === "confirm") {
      setRulesSeen(true);
      setDrawer("rules");
    }
  }, [data, panelInit]);

  // A cover just happened: the prepared message opens in the drawer once.
  const hasCoverMessage = Boolean(change?.kind === "cover" && change.message && dismissedMessage !== change.at);
  useEffect(() => {
    if (hasCoverMessage && change && messageShown.current !== change.at) {
      messageShown.current = change.at;
      openDrawer("message");
    }
  }, [hasCoverMessage, change, openDrawer]);

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

  if (week.isLoading) {
    return (
      <div className="board-root">
        <TopBar />
        <div className="board-body space-y-4 p-3 sm:p-5">
          <div className="skeleton-cell" style={{ width: "14rem", height: "2rem" }} />
          <SheetSkeleton />
          <p className="hint" role="status">Loading your week...</p>
        </div>
      </div>
    );
  }
  if (week.error) {
    return (
      <div className="board-root">
        <TopBar />
        <div className="board-body p-6" role="alert">
          <p className="problem-line">Your week couldn't be loaded.</p>
          <p className="hint mt-1">{actionErrorMessage(week.error) ?? "Check your connection and try again."}</p>
          <button type="button" className={`${btnSecondary} mt-3`} onClick={() => void week.refetch()}>Try again</button>
        </div>
      </div>
    );
  }

  if (!data || !data.hasWeek) {
    return (
      <div className="board-root">
        <TopBar />
        <div className="board-body">
          {mode === "setup" ? (
            <SetupForm existing={null} onCancel={() => setMode("main")} onDone={() => setMode("main")} />
          ) : (
            <Welcome
              loadingSample={loadSample.isPending}
              error={sampleError}
              onSetup={() => setMode("setup")}
              onSample={() => {
                setSampleError(null);
                loadSample.mutate({}, { onError: (err) => setSampleError(errText(err, "Couldn't load the sample restaurant.")) });
              }}
            />
          )}
        </div>
      </div>
    );
  }

  const restaurant = cleanWeekName(data.week?.name ?? "");

  if (mode === "setup") {
    return (
      <div className="board-root">
        <TopBar name={restaurant} sample={Boolean(data.week?.isSample)} />
        <div className="board-body">
          <SetupForm
            existing={data}
            onCancel={() => setMode("main")}
            onDone={() => {
              setMode("main");
              setSelectedId(null);
            }}
          />
        </div>
      </div>
    );
  }

  const proposedCount = data.rules.filter((r) => r.status === "proposed" && r.kind !== "note").length;
  const confirmedCount = data.rules.filter((r) => r.status === "confirmed" && r.kind !== "note").length;
  const placed = data.slots.some((s) => s.staffId);
  const ns = data.nextStep;
  const nextButton: { label: string; run: () => void } | null = (
    {
      rules: { label: "Add staff messages", run: () => openDrawer("rules") },
      confirm: { label: `Check ${proposedCount} rule${proposedCount === 1 ? "" : "s"}`, run: () => openDrawer("rules") },
      publish: { label: "Share the week", run: () => openDrawer("share") },
      build: null,
      done: null,
      setup: null,
    } as const
  )[ns];

  const steps: Step[] = [
    { id: "staff", label: "Staff and shifts", state: "done" as StepState, note: `${data.staff.length} people, ${data.slots.length} shifts` },
    {
      id: "rules",
      label: "Rules",
      state: ns === "rules" || ns === "confirm" || proposedCount > 0 ? "current" : confirmedCount > 0 ? "done" : "todo",
      ...(proposedCount > 0 ? { badge: `${proposedCount} waiting` } : {}),
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
    else if (id === "rules") (drawer === "rules" ? closeDrawer : () => openDrawer("rules"))();
    else if (id === "share") (drawer === "share" ? closeDrawer : () => openDrawer("share"))();
    else document.querySelector<HTMLElement>("[data-testid=build-week]")?.focus();
  }

  const guidance = touch || narrow ? "Tap a shift to see why that person has it." : "Click a shift to see why, or drag it onto another person's row.";
  const drawerTitle: Record<DrawerKind, string> = {
    receipt: selected ? "Why this shift" : "Shift",
    cover: "Who can cover",
    rules: "Staff messages and rules",
    share: "Share with your staff",
    tally: "Fairness this week",
    message: "Message for your cover",
  };

  return (
    <div className="board-root" data-testid="week-page" data-drawer={drawer ?? undefined}>
      <TopBar name={restaurant} sample={Boolean(data.week?.isSample)} steps={steps} onPick={pickStep} />

      <div className="board-main">
        <div className="board-center">
          <div className="board-title">
            <h1 className="week-of">Week of {dayLabel(data.week!.startDate)}</h1>
            <button type="button" className="link" onClick={() => setMode("setup")}>
              {data.week?.isSample ? "Set up my own restaurant" : "Edit staff and shifts"}
            </button>
            <span className="hint guidance">{guidance}</span>
            <div className="board-title-end">
              {data.fairness && !narrow ? <CountedNote closes={data.fairness.averages.closes} weekends={data.fairness.averages.weekends} /> : null}
              <div className="primary-slot" data-testid="next-step">
                {nextButton ? (
                  <button type="button" className={btnPrimary} onClick={nextButton.run}>
                    {nextButton.label}
                  </button>
                ) : null}
                <BuildControl
                  week={data}
                  onResult={(r) => {
                    setBuildResult(r);
                    setDismissedChange("");
                  }}
                  onError={(m) => setNotice({ kind: "error", text: m })}
                />
              </div>
            </div>
          </div>

          <div className="board-notes">
            {agentRunning ? (
              <div role="status" data-testid="agent-strip">
                <div className="agent-strip" />
                <p className="hint mt-1">Your assistant is working. The sheet updates here when it changes something.</p>
              </div>
            ) : null}
            {notice && !(notice.kind === "ok" && changedIds.size > 0) ? (
              <div
                role={notice.kind === "error" ? "alert" : "status"}
                data-testid="board-notice"
                className="board-note"
                data-kind={notice.kind === "error" ? "problem" : "ok"}
              >
                <span className={notice.kind === "error" ? "problem-line" : ""}>{notice.text}</span>
                <button type="button" className="link shrink-0" onClick={() => setNotice(null)}>Dismiss</button>
              </div>
            ) : null}
            {buildResult ? (
              <BuildResultLine result={buildResult} onSelectSlot={selectShift} onDismiss={() => setBuildResult(null)} />
            ) : change?.kind === "build" && change.at !== dismissedChange ? (
              <div data-testid="change-banner" className="board-note" data-kind="ok">
                <span><strong>Week built.</strong> {change.summary}</span>
                <button type="button" className="link shrink-0" onClick={() => setDismissedChange(change.at)}>Dismiss</button>
              </div>
            ) : changedIds.size > 0 && change ? (
              <div data-testid="change-banner" className="board-note" data-kind="changed">
                <span>
                  <strong>{changedIds.size} shift{changedIds.size === 1 ? "" : "s"} changed</strong> and marked Changed. {change.summary}
                </span>
                <button type="button" className="link shrink-0" onClick={() => setDismissedChange(change.at)}>Clear marks</button>
              </div>
            ) : null}
          </div>

          <section aria-label="Week sheet" className="board-sheet">
            {narrow ? (
              <DayList
                week={data}
                selectedId={selectedId}
                changedIds={changedIds}
                pendingSlot={pendingSlot}
                onSelect={selectShift}
                onTally={() => openDrawer("tally")}
              />
            ) : (
              <WeekGrid
                week={data}
                selectedId={selectedId}
                changedIds={changedIds}
                pendingSlot={pendingSlot}
                onSelect={selectShift}
                onDropTo={(slotId, staffId) => doMove(slotId, staffId)}
              />
            )}
          </section>
        </div>

        {drawer ? (
          <Drawer title={drawerTitle[drawer]} onClose={closeDrawer}>
            {rulesSeen ? (
              <div className="drawer-body" hidden={drawer !== "rules"}>
                <RulesPanel week={data} />
              </div>
            ) : null}
            {drawer === "receipt" && selected ? (
              <ShiftPanel
                key={selected.id}
                slot={selected}
                week={data}
                moving={move.isPending}
                onMove={(staffId, lock) => doMove(selected.id, staffId, lock)}
                onCover={() => openDrawer("cover")}
              />
            ) : null}
            {drawer === "cover" && selected ? (
              <div className="drawer-body">
                <CoverFlow key={selected.id} slot={selected} onClose={() => openDrawer("receipt")} onNotice={setNotice} />
              </div>
            ) : null}
            {drawer === "share" ? (
              <div className="drawer-body">
                <PublishPanel week={data} />
              </div>
            ) : null}
            {drawer === "tally" ? (
              <div className="drawer-body">
                <p className="hint mb-3">
                  A close is a shift that ends at 22:00 or later. Weekends are Saturday and Sunday. The triangle under each line is the team average. Figures come from the scheduling engine.
                </p>
                <TallyList week={data} />
              </div>
            ) : null}
            {drawer === "message" && hasCoverMessage && change ? (
              <div className="drawer-body">
                <PreparedMessage
                  message={change.message!}
                  onDone={() => {
                    setDismissedMessage(change.at);
                    closeDrawer();
                  }}
                />
              </div>
            ) : null}
          </Drawer>
        ) : null}
      </div>
    </div>
  );
}
