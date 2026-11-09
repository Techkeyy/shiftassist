import { deleteClientAppState, useActionMutation, writeClientAppState } from "@agent-native/core/client/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";

import type { BuildResult } from "../../../server/lib/assignments";
import type { WeekView } from "../../../server/lib/week-view";
import { TAB_ID } from "@/lib/tab-id";
import { Clip, Pin, Zig } from "./art";
import { BuildControl, BuildResultLine } from "./BuildPanel";
import { btnPrimary, btnSecondary, copyText, errText, fairnessSummary } from "./format";
import { CoverFlow, ShiftPanel } from "./ShiftPanel";
import { StepShell } from "./StepShell";
import { DayList, TallyList, WeekGrid } from "./WeekGrid";
import { factsOf } from "./week-state";

type Notice = { kind: "error" | "ok"; text: string };
type DrawerKind = "receipt" | "cover" | "tally" | "message";

export function useMq(query: string, initial = false) {
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

function store(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode: fine */
  }
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

const COACH_KEY = "sa-coach-v1";

/** Three first-visit coach marks. Remembered per browser; reopened from "How this works". */
function CoachMarks({ narrow, onClose }: { narrow: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const steps = narrow
    ? [
        { text: "Each box is one shift, with the person who has it.", target: ".day-sheet .slip" },
        { text: "Tap any shift to see why that person has it.", target: ".day-sheet .slip" },
        { text: "Use Move to change it. We stop anything that breaks a rule.", target: ".day-sheet .slip" },
      ]
    : [
        { text: "Each row is a person.", target: ".rota tbody tr:first-child th" },
        { text: "Click any shift to see why that person has it.", target: ".rota .slip" },
        { text: "Drag it, or use Move, to change it. We stop anything that breaks a rule.", target: ".rota .slip" },
      ];
  const step = steps[i]!;
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(step.target);
    el?.classList.add("coach-target");
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    return () => el?.classList.remove("coach-target");
  }, [step.target, i]);
  const last = i === steps.length - 1;
  return (
    <div className="coach" role="dialog" aria-label="How this works" data-testid="coach">
      <p className="coach-count">{i + 1} of {steps.length}</p>
      <p className="coach-text">{step.text}</p>
      <div className="coach-actions">
        <button type="button" className="link" onClick={onClose}>Skip</button>
        <button type="button" className={btnPrimary} onClick={() => (last ? onClose() : setI(i + 1))}>
          {last ? "Got it" : "Next"}
        </button>
      </div>
    </div>
  );
}

export function WeekStep({ data }: { data: WeekView }) {
  const move = useActionMutation("move-shift");
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);
  const [dismissedChange, setDismissedChange] = useState<string | null>(null);
  const [showFairness, setShowFairness] = useState(() => store("sa-fairness") === "1");
  const [coach, setCoach] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [dismissedMessage, setDismissedMessageState] = useState<string | null>(() => store("sa-dismissed-cover"));
  const opener = useRef<HTMLElement | null>(null);
  const messageShown = useRef<string | null | undefined>(undefined);

  const narrow = useMq("(max-width: 1023px)");
  const touch = useMq("(pointer: coarse)");
  const facts = factsOf(data);
  const change = data.lastChange ?? null;

  const setDismissedMessage = (at: string) => {
    setDismissedMessageState(at);
    remember("sa-dismissed-cover", at);
  };

  useEffect(() => {
    const onRun = (e: Event) => setAgentRunning(Boolean((e as CustomEvent<{ isRunning?: boolean }>).detail?.isRunning));
    window.addEventListener("agentNative.chatRunning", onRun);
    return () => window.removeEventListener("agentNative.chatRunning", onRun);
  }, []);

  const selected = useMemo(() => data.slots.find((s) => s.id === selectedId) ?? null, [data, selectedId]);
  const changedIds = useMemo(
    () => new Set(change && change.kind !== "build" && change.at !== dismissedChange ? change.slotIds : []),
    [change, dismissedChange],
  );

  const openDrawer = useCallback((kind: DrawerKind) => {
    setDrawer((cur) => {
      if (cur === null) opener.current = document.activeElement as HTMLElement | null;
      return kind;
    });
    if (kind !== "receipt" && kind !== "cover") setSelectedId(null);
  }, []);

  // Closing the cover message with X counts as dismissing it, so a reload never pops it open again.
  const hasCoverMessage = Boolean(change?.kind === "cover" && change.message && dismissedMessage !== change.at);
  const closeDrawer = useCallback(() => {
    const id = selectedId;
    if (drawer === "message" && change?.kind === "cover") setDismissedMessage(change.at);
    setDrawer(null);
    setSelectedId(null);
    window.setTimeout(() => {
      const el = opener.current;
      if (el && el.isConnected) el.focus({ preventScroll: true });
      else if (id) document.querySelector<HTMLElement>(`[data-slot-id="${id}"]`)?.focus({ preventScroll: true });
      opener.current = null;
    }, 0);
  }, [selectedId, drawer, change]);

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

  // Home's "Someone called in sick?" lands here with the shift already picked.
  useEffect(() => {
    const shift = params.get("shift");
    if (!shift || !data.slots.some((s) => s.id === shift)) return;
    setSelectedId(shift);
    setDrawer(params.get("cover") ? "cover" : "receipt");
    setParams({}, { replace: true });
  }, [params, data.slots, setParams]);

  // A cover that happens while this page is open shows its message once. A cover that was already
  // there when the page loaded never pops open on its own.
  useEffect(() => {
    if (messageShown.current === undefined) {
      messageShown.current = change?.kind === "cover" ? change.at : null;
      return;
    }
    if (hasCoverMessage && change && messageShown.current !== change.at) {
      messageShown.current = change.at;
      openDrawer("message");
    }
  }, [hasCoverMessage, change, openDrawer]);

  // First visit to a built week: three coach marks.
  useEffect(() => {
    if (facts.placed && store(COACH_KEY) !== "1") {
      const t = window.setTimeout(() => setCoach(true), 600);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [facts.placed]);
  const closeCoach = () => {
    setCoach(false);
    remember(COACH_KEY, "1");
  };

  // Tell the assistant which shift is selected (context-awareness: tab-scoped `selection`).
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

  const toggleFairness = () => {
    if (narrow) {
      openDrawer("tally");
      return;
    }
    setShowFairness((v) => {
      remember("sa-fairness", v ? "0" : "1");
      return !v;
    });
  };
  const summary = fairnessSummary(data.fairness?.people);

  const drawerTitle: Record<DrawerKind, string> = {
    receipt: selected ? "Why this shift" : "Shift",
    cover: "Who can cover",
    tally: "Is it fair?",
    message: "Message for your cover",
  };

  const buildBar = (
    <BuildControl
      week={data}
      primary={!facts.placed}
      big={!facts.placed}
      onResult={(r) => {
        setBuildResult(r);
        setDismissedChange("");
      }}
      onError={(m) => setNotice({ kind: "error", text: m })}
    />
  );

  const notes = (
    <div className="board-notes">
      {agentRunning ? (
        <div role="status" data-testid="agent-strip">
          <div className="agent-strip" />
          <p className="hint mt-1">The assistant is working. Your week updates here when it changes something.</p>
        </div>
      ) : null}
      {notice && !(notice.kind === "ok" && changedIds.size > 0) ? (
        <div role={notice.kind === "error" ? "alert" : "status"} data-testid="board-notice" className="board-note" data-kind={notice.kind === "error" ? "problem" : "ok"}>
          <span className={notice.kind === "error" ? "problem-line" : ""}>{notice.text}</span>
          <button type="button" className="link shrink-0" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      ) : null}
      {buildResult ? (
        <BuildResultLine result={buildResult} onSelectSlot={selectShift} onDismiss={() => setBuildResult(null)} />
      ) : changedIds.size > 0 && change ? (
        <div data-testid="change-banner" className="board-note" data-kind="changed">
          <span>
            <strong>{changedIds.size} {changedIds.size === 1 ? "shift" : "shifts"} changed</strong> and marked in yellow. {change.summary}
          </span>
          <button type="button" className="link shrink-0" onClick={() => setDismissedChange(change.at)}>Clear marks</button>
        </div>
      ) : null}
    </div>
  );

  const next = facts.placed
    ? { label: "Next: Share with staff", to: "/share" }
    : { label: "Next: Share with staff", disabledReason: "Build your week first" };

  return (
    <>
      <StepShell
        current="week"
        title={facts.placed ? "Here is your week" : "Build your week"}
        lead={
          facts.placed
            ? touch || narrow
              ? "Tap a shift to see why that person has it."
              : "Click a shift to see why that person has it, or drag it onto another person's row."
            : "Press the button. We place everyone and keep every rule you confirmed."
        }
        back={{ label: "Back", to: "/rules" }}
        next={next}
      >
        {!facts.placed ? (
          <div className="build-moment">
            <p className="build-moment-facts">
              {data.staff.length} people, {data.slots.length} shifts to fill, {facts.inUse} {facts.inUse === 1 ? "rule" : "rules"} in use.
            </p>
            {facts.proposed > 0 ? (
              <p className="hint">{facts.proposed} {facts.proposed === 1 ? "rule is" : "rules are"} still waiting for your check and won't be used. You can go back to check {facts.proposed === 1 ? "it" : "them"}.</p>
            ) : null}
            <div className="mt-3">{buildBar}</div>
            {notes}
          </div>
        ) : (
          <>
            {notes}
            <div className="week-tools">
              <p className="legend" data-testid="legend">
                <span className="legend-slip">Lunch 10-4</span> is one shift.{" "}
                <span className="legend-lock"><Pin className="slip-pin" /></span> means locked: rebuilding won't move it.{" "}
                <span className="legend-changed" aria-hidden="true" /> Yellow means you changed it.
              </p>
              <div className="week-tools-end">
                {narrow ? null : (
                  <button type="button" className="link" aria-pressed={showFairness} onClick={toggleFairness}>
                    {showFairness ? "Hide fairness" : "Show fairness"}
                  </button>
                )}
                <button type="button" className="link" onClick={() => setCoach(true)}>How this works</button>
                {buildBar}
              </div>
            </div>
            {summary ? (
              <p className="fair-line" data-even={summary.even ? "true" : "false"} data-testid="fairness-summary">{summary.text}</p>
            ) : null}
            <section aria-label="Your week" className="board-sheet">
              {narrow ? (
                <DayList week={data} selectedId={selectedId} changedIds={changedIds} pendingSlot={pendingSlot} onSelect={selectShift} onTally={() => openDrawer("tally")} />
              ) : (
                <WeekGrid
                  week={data}
                  selectedId={selectedId}
                  changedIds={changedIds}
                  pendingSlot={pendingSlot}
                  onSelect={selectShift}
                  onDropTo={(slotId, staffId) => doMove(slotId, staffId)}
                  showFairness={showFairness}
                />
              )}
            </section>
            {showFairness && !narrow ? (
              <p className="hint">Each mark is one shift. The little triangle on each line is the team average.</p>
            ) : null}
          </>
        )}
      </StepShell>

      {coach ? <CoachMarks narrow={narrow} onClose={closeCoach} /> : null}

      {drawer ? (
        <Drawer title={drawerTitle[drawer]} onClose={closeDrawer}>
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
          {drawer === "tally" ? (
            <div className="drawer-body">
              {summary ? <p className="fair-line mb-3" data-even={summary.even ? "true" : "false"}>{summary.text}</p> : null}
              <p className="hint mb-3">A closing shift ends at 10pm or later. Weekends are Saturday and Sunday. The triangle on each line is the team average.</p>
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
    </>
  );
}
