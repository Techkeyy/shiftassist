import { AgentToggleButton } from "@agent-native/toolkit/app/chat";
import { OrgSwitcher } from "@agent-native/toolkit/app/org";

import { Clip, Mark } from "./art";

export type StepState = "done" | "current" | "todo";
export type Step = { id: string; label: string; state: StepState; note: string };

/** Slim top bar: mark, restaurant, the step rail, chat toggle, account. Replaces the left sidebar. */
export function TopBar({
  name,
  sample,
  steps,
  onPick,
}: {
  name?: string | undefined;
  sample?: boolean | undefined;
  steps?: Step[] | undefined;
  onPick?: ((id: string) => void) | undefined;
}) {
  const rail = steps ? (
    <nav aria-label="Steps" data-testid="steps" className="topbar-steps">
      <ol>
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="step"
              aria-current={s.state === "current" ? "step" : undefined}
              title={`${s.label}: ${s.note}`}
              onClick={() => onPick?.(s.id)}
            >
              <Clip className="step-clip" closed={s.state !== "todo"} height={18} />
              <span className="step-label">{s.label}</span>
              <span className="step-state">{s.state === "done" ? "Done" : s.state === "current" ? "Next" : ""}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  ) : null;
  return (
    <header className="topbar" data-testid="topbar">
      <div className="topbar-row">
        <a href="/board" className="brand" aria-label="ShiftAssist, back to the week">
          <Mark size={20} />
          <span className="display brand-word">ShiftAssist</span>
        </a>
        {name ? (
          <span className="topbar-name">
            <span className="display">{name}</span>
            {sample ? <span className="sample-tag">Sample</span> : null}
          </span>
        ) : null}
        <div className="topbar-steps-slot">{rail}</div>
        <div className="topbar-end">
          <AgentToggleButton />
          <OrgSwitcher reserveSpace compact currentAppId="chat" className="size-8 bg-transparent p-0 hover:bg-accent" />
        </div>
      </div>
      {rail ? <div className="topbar-steps-phone">{rail}</div> : null}
    </header>
  );
}
