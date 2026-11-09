import { actionErrorMessage } from "@agent-native/core/client/hooks";
import type { ReactNode } from "react";
import { Link, Navigate } from "react-router";

import type { WeekView } from "../../../server/lib/week-view";
import { btnPrimary, btnSecondary, cleanWeekName } from "./format";
import { type StepId, TopBar } from "./TopBar";
import { stepsOf, useWeek } from "./week-state";

export interface FooterAction {
  label: string;
  to?: string;
  onClick?: () => void;
  /** Makes the button submit the form with this id. */
  form?: string;
  /** When set, the button is disabled and this says why. */
  disabledReason?: string;
  busy?: boolean;
}

export interface ShellProps {
  current: StepId;
  title: string;
  lead: ReactNode;
  back?: { label: string; to: string };
  next: FooterAction;
  /** A quiet extra choice beside the primary, such as "Skip for now". */
  skip?: { label: string; to: string };
  /** Make the footer button quiet when the screen's own big button is the primary. */
  nextQuiet?: boolean;
  children: ReactNode;
}

export function PageFrame({ children, name, sample, steps, current }: { children: ReactNode; name?: string | undefined; sample?: boolean | undefined; steps?: ReturnType<typeof stepsOf> | undefined; current?: StepId | undefined }) {
  return (
    <div className="step-root">
      <TopBar name={name} sample={sample} steps={steps} current={current} />
      {children}
    </div>
  );
}

function Loading() {
  return (
    <div className="step-body">
      <div className="step-inner space-y-4" role="status" aria-label="Loading your week">
        <div className="skeleton-cell" style={{ width: "16rem", height: "2.25rem" }} />
        <div className="skeleton-cell" style={{ width: "100%", maxWidth: "36rem", height: "1.25rem" }} />
        <div className="skeleton-cell" style={{ width: "100%", height: "12rem" }} />
        <p className="hint">Loading your week...</p>
      </div>
    </div>
  );
}

/** Loads the week once and hands it to the screen. Redirects Home when there is no week yet (except where `allowEmpty`). */
export function WeekLoader({
  current,
  allowEmpty,
  noRail,
  children,
}: {
  current?: StepId;
  allowEmpty?: boolean;
  noRail?: boolean;
  children: (w: WeekView) => ReactNode;
}) {
  const q = useWeek();
  if (q.isLoading) {
    return <PageFrame><Loading /></PageFrame>;
  }
  if (q.error || !q.data) {
    return (
      <PageFrame>
        <div className="step-body">
          <div className="step-inner" role="alert">
            <p className="problem-line">Your week couldn't be loaded.</p>
            <p className="hint mt-1">{actionErrorMessage(q.error) ?? "Check your connection and try again."}</p>
            <button type="button" className={`${btnSecondary} mt-3`} onClick={() => void q.refetch()}>Try again</button>
          </div>
        </div>
      </PageFrame>
    );
  }
  const w = q.data;
  if (!w.hasWeek && !allowEmpty) return <Navigate to="/home" replace />;
  return (
    <PageFrame
      name={w.hasWeek ? cleanWeekName(w.week?.name ?? "") : undefined}
      sample={Boolean(w.week?.isSample)}
      steps={noRail ? undefined : stepsOf(w)}
      current={current}
    >
      {children(w)}
    </PageFrame>
  );
}

function FooterButton({ a, quiet }: { a: FooterAction; quiet?: boolean | undefined }) {
  const cls = quiet ? btnSecondary : btnPrimary;
  const label = a.busy ? "Saving..." : a.label;
  if (a.disabledReason) {
    return <button type="button" className={cls} disabled data-testid="step-next">{label}</button>;
  }
  if (a.to && !a.form) return <Link to={a.to} className={cls} data-testid="step-next">{label}</Link>;
  return (
    <button type={a.form ? "submit" : "button"} {...(a.form ? { form: a.form } : {})} className={cls} disabled={a.busy} data-testid="step-next" onClick={a.onClick}>
      {label}
    </button>
  );
}

/** One job per screen: heading, one sentence, the work, and a fixed footer with Back and one Next. */
export function StepShell({ current, title, lead, back, next, skip, nextQuiet, children }: ShellProps) {
  return (
    <>
      <div className="step-body" data-step={current}>
        <div className="step-inner">
          <p className="step-kicker">Step {["team", "rules", "week", "share"].indexOf(current) + 1} of 4</p>
          <h1 className="display step-title">{title}</h1>
          <p className="step-lead">{lead}</p>
          <div className="step-work">{children}</div>
        </div>
      </div>
      <footer className="step-foot" data-testid="step-footer">
        <div className="step-foot-in">
          {back ? <Link to={back.to} className={btnSecondary}>{back.label}</Link> : <span />}
          <div className="step-foot-end">
            {next.disabledReason ? <span className="hint step-reason" role="status">{next.disabledReason}</span> : null}
            {skip ? <Link to={skip.to} className="link">{skip.label}</Link> : null}
            <FooterButton a={next} quiet={nextQuiet} />
          </div>
        </div>
      </footer>
    </>
  );
}
