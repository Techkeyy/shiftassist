import { AgentToggleButton } from "@agent-native/toolkit/app/chat";
import { OrgSwitcher } from "@agent-native/toolkit/app/org";
import { Link } from "react-router";

import { Mark } from "./art";

export type StepId = "team" | "rules" | "week" | "share";
export type Step = { id: StepId; label: string; to: string; done: boolean; note: string; badge?: string };

export const STEP_DEFS: { id: StepId; label: string; to: string }[] = [
  { id: "team", label: "Team", to: "/team" },
  { id: "rules", label: "Rules", to: "/rules" },
  { id: "week", label: "Week", to: "/week" },
  { id: "share", label: "Share", to: "/share" },
];

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Top bar: logo (to Home), the four numbered steps, the labelled assistant button, the account menu. */
export function TopBar({
  name,
  sample,
  steps,
  current,
}: {
  name?: string | undefined;
  sample?: boolean | undefined;
  steps?: Step[] | undefined;
  current?: StepId | undefined;
}) {
  const rail = steps ? (
    <nav aria-label="Steps" data-testid="steps" className="topbar-steps">
      <ol>
        {steps.map((s, i) => (
          <li key={s.id}>
            <Link
              to={s.to}
              className="step"
              aria-current={s.id === current ? "step" : undefined}
              title={`${s.label}: ${s.note}`}
              data-done={s.done ? "true" : undefined}
            >
              <span className="step-no" aria-hidden="true">{s.done && s.id !== current ? <Check /> : i + 1}</span>
              <span className="step-label">{s.label}</span>
              {s.done ? <span className="sr-only"> (done)</span> : null}
              {s.badge ? <span className="step-state" data-badge="true">{s.badge}</span> : null}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  ) : null;
  return (
    <header className="topbar" data-testid="topbar">
      <div className="topbar-row">
        <Link to="/home" className="brand" aria-label="ShiftAssist, go to Home">
          <Mark size={20} />
          <span className="display brand-word">ShiftAssist</span>
        </Link>
        {name ? (
          <span className="topbar-name">
            <span className="display">{name}</span>
            {sample ? <span className="sample-tag">Sample</span> : null}
          </span>
        ) : null}
        <div className="topbar-steps-slot">{rail}</div>
        <div className="topbar-end">
          <AgentToggleButton
            className="ask-btn"
            icon={
              <span className="ask-inner">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M2 3h12v8H7l-3 3v-3H2z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
                <span>Ask the assistant</span>
              </span>
            }
          />
          <OrgSwitcher reserveSpace compact currentAppId="chat" className="size-8 bg-transparent p-0 hover:bg-accent" />
        </div>
      </div>
      {rail ? <div className="topbar-steps-phone">{rail}</div> : null}
    </header>
  );
}
