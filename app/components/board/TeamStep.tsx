import { useActionMutation } from "@agent-native/core/client/hooks";
import { useState } from "react";
import { useNavigate } from "react-router";

import type { WeekView } from "../../../server/lib/week-view";
import { btnSecondary, errText, timeWords } from "./format";
import { SetupForm } from "./SetupForm";
import { StepShell } from "./StepShell";
import { plural } from "./week-state";

/** The sample team, read-only: who works here and which kinds of shift exist. */
function SampleTeam({ week }: { week: WeekView }) {
  const kinds = new Map<string, { label: string; start: string; end: string; n: number }>();
  for (const s of week.slots) {
    const k = `${s.label}|${s.start}|${s.end}`;
    const cur = kinds.get(k);
    if (cur) cur.n += 1;
    else kinds.set(k, { label: s.label, start: s.start, end: s.end, n: 1 });
  }
  return (
    <div className="team-sample">
      <section aria-labelledby="t-people">
        <h2 id="t-people" className="display setup-h">Your people</h2>
        <ul className="team-list" data-testid="team-list">
          {week.staff.map((p) => (
            <li key={p.id}>
              <strong>{p.name}</strong>
              <span>{p.roles.join(", ")}</span>
              <span className="hint">up to {plural(p.maxShifts, "shift")} a week</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="t-shifts">
        <h2 id="t-shifts" className="display setup-h">Which shifts you need</h2>
        <ul className="team-list">
          {[...kinds.values()].map((k) => (
            <li key={`${k.label}${k.start}`}>
              <strong>{k.label}</strong>
              <span>{timeWords(k.start, k.end)}</span>
              <span className="hint">{plural(k.n, "shift")} this week</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function TeamStep({ data }: { data: WeekView }) {
  const navigate = useNavigate();
  const sample = Boolean(data.week?.isSample);
  const loadSample = useActionMutation("load-sample-week");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const showForm = !data.hasWeek || !sample || editing;

  return (
    <StepShell
      current="team"
      title="Who works here, and which shifts do you need?"
      lead={
        showForm
          ? "Add each person on their own row, then the shifts you need in a normal week. You can change all of it later."
          : "This is a made-up restaurant so you can try everything. Press Next to carry on, or set up your own."
      }
      back={{ label: "Back to Home", to: "/home" }}
      next={
        showForm
          ? { label: "Next: Add staff messages", form: "team-form", busy }
          : { label: "Next: Add staff messages", to: "/rules" }
      }
    >
      {showForm ? (
        <>
          <SetupForm
            formId="team-form"
            existing={data.hasWeek ? data : null}
            onBusy={setBusy}
            onCancel={null}
            onDone={() => navigate("/rules")}
          />
          {!data.hasWeek ? (
            <p className="hint mt-4">
              Just looking?{" "}
              <button
                type="button"
                className="link"
                disabled={loadSample.isPending}
                onClick={() => {
                  setSampleError(null);
                  loadSample.mutate({}, { onSuccess: () => navigate("/team"), onError: (e) => setSampleError(errText(e, "Couldn't load the sample restaurant.")) });
                }}
              >
                {loadSample.isPending ? "Loading the sample..." : "Use the sample restaurant instead"}
              </button>
            </p>
          ) : null}
          {sampleError ? <p role="alert" className="problem-line mt-2">{sampleError}</p> : null}
        </>
      ) : (
        <>
          <SampleTeam week={data} />
          <p className="mt-4">
            <button type="button" className={btnSecondary} onClick={() => setEditing(true)}>
              Set up my own restaurant instead
            </button>
          </p>
        </>
      )}
    </StepShell>
  );
}
