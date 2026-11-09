import { useActionMutation } from "@agent-native/core/client/hooks";
import { useState } from "react";
import { Link, useNavigate } from "react-router";

import type { WeekView } from "../../../server/lib/week-view";
import { btnPrimary, btnSecondary, cleanWeekName, dayLabel, errText, timeWords } from "./format";
import { PageFrame, WeekLoader } from "./StepShell";
import { WeekPreview } from "./WeekPreview";
import { factsOf, nextStepOf, plural, stepsOf } from "./week-state";

const HAPPENS = [
  ["Tell us your team", "Who works here and which shifts you need."],
  ["Paste your staff's messages", "Each one becomes a rule that you confirm."],
  ["Get a week that keeps every rule", "We place everyone. You can change anything."],
  ["Share it", "Send your staff a link, and handle sick days in one click."],
] as const;

function NewAccount() {
  const navigate = useNavigate();
  const sample = useActionMutation("load-sample-week");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="step-body">
      <div className="step-inner home-inner">
        <h1 className="display step-title">Let's build your first week.</h1>
        <p className="step-lead">It takes about a minute with the sample. Pick how you want to start. Restaurants are our main example, but it also works for any small team that works shifts, such as cafés, clinics and shops.</p>
        <div className="choice-grid">
          <div className="choice">
            <h2 className="display">Try it first</h2>
            <p>A made-up restaurant with a team, shifts and staff messages. Takes about 1 minute.</p>
            <button
              type="button"
              className={`${btnPrimary} btn-big`}
              disabled={sample.isPending}
              data-testid="start-sample"
              onClick={() => {
                setError(null);
                sample.mutate({}, { onSuccess: () => navigate("/team"), onError: (e) => setError(errText(e, "Couldn't load the sample restaurant.")) });
              }}
            >
              {sample.isPending ? "Loading the sample..." : "See it with a sample restaurant (1 minute)"}
            </button>
          </div>
          <div className="choice">
            <h2 className="display">Start with your own team</h2>
            <p>Add your people and the shifts you need. A few minutes.</p>
            <Link to="/team" className={`${btnSecondary} btn-big`} data-testid="start-own">Set up my own restaurant</Link>
          </div>
        </div>
        {error ? <p role="alert" className="problem-line mt-3">{error}</p> : null}
        <section className="happens" aria-labelledby="happens-h">
          <h2 id="happens-h" className="display setup-h">What happens next</h2>
          <ol>
            {HAPPENS.map(([t, d], i) => (
              <li key={t}>
                <span className="no-badge" aria-hidden="true">{i + 1}</span>
                <span><strong>{t}</strong> {d}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

/** "Someone called in sick?": pick the person, then the shift, and land on the cover options. */
function SickPanel({ week, onClose }: { week: WeekView; onClose: () => void }) {
  const navigate = useNavigate();
  const people = week.staff.filter((p) => week.slots.some((s) => s.staffId === p.id));
  const [who, setWho] = useState<string | null>(null);
  const mine = week.slots.filter((s) => s.staffId === who).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return (
    <div className="sick-panel" role="group" aria-label="Someone called in sick" data-testid="sick-panel">
      {!who ? (
        <>
          <p className="font-medium">Who called in sick?</p>
          <div className="sick-people">
            {people.map((p) => (
              <button key={p.id} type="button" className={btnSecondary} onClick={() => setWho(p.id)}>{p.name}</button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="font-medium">Which shift can {week.staff.find((p) => p.id === who)?.name} not do?</p>
          <div className="sick-people">
            {mine.map((s) => (
              <button
                key={s.id}
                type="button"
                className={btnSecondary}
                onClick={() => navigate(`/week?shift=${encodeURIComponent(s.id)}&cover=1`)}
              >
                {dayLabel(s.date)}, {s.label}, {timeWords(s.start, s.end)}
              </button>
            ))}
          </div>
          <button type="button" className="link" onClick={() => setWho(null)}>Pick someone else</button>
        </>
      )}
      <button type="button" className="link" onClick={onClose}>Cancel</button>
    </div>
  );
}

function ExistingWeek({ week }: { week: WeekView }) {
  const [sick, setSick] = useState(false);
  const f = factsOf(week);
  const next = nextStepOf(week);
  const steps = stepsOf(week);
  const status: Record<string, string> = {
    team: `${plural(f.people, "person", "people")}, ${plural(f.shifts, "shift")}`,
    rules: f.proposed > 0 ? `${f.inUse} in use, ${f.proposed} waiting` : week.exampleMessages && f.inUse > 0 && !week.rules.some((r) => r.status === "confirmed" && r.source && !/^\w+:/.test(r.source)) ? `${f.inUse} in use. Try the sample messages` : `${f.inUse} in use`,
    week: f.placed ? `${f.filled} of ${f.shifts} filled` : "Not built yet",
    share: f.published ? "Live" : "Not shared",
  };
  return (
    <div className="step-body">
      <div className="step-inner home-inner">
        <p className="step-kicker">Week of {dayLabel(week.week!.startDate)}</p>
        <h1 className="display step-title">{cleanWeekName(week.week?.name ?? "")}</h1>

        <section className="next-card" aria-labelledby="next-h" data-testid="next-card">
          <p id="next-h" className="next-label">Your next step</p>
          <p className="next-sentence" data-testid="next-sentence">{next.sentence}</p>
          <div className="next-actions">
            <Link to={next.to} className={`${btnPrimary} btn-big`} data-testid="next-button">{next.button}</Link>
            {f.placed ? (
              <button type="button" className={btnSecondary} aria-expanded={sick} onClick={() => setSick((v) => !v)} data-testid="sick-button">
                Someone called in sick?
              </button>
            ) : null}
          </div>
          {sick ? <SickPanel week={week} onClose={() => setSick(false)} /> : null}
        </section>

        <section aria-labelledby="steps-h" className="home-section">
          <h2 id="steps-h" className="display setup-h">The four steps</h2>
          <ol className="checklist" data-testid="checklist">
            {steps.map((s, i) => (
              <li key={s.id}>
                <Link to={s.to} className="check-row" data-done={s.done ? "true" : undefined}>
                  <span className="no-badge" aria-hidden="true">{s.done ? "✓" : i + 1}</span>
                  <span className="check-name">{s.label}</span>
                  <span className="check-note">{status[s.id]}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {f.placed ? (
          <section aria-labelledby="prev-h" className="home-section">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="prev-h" className="display setup-h">Your week at a glance</h2>
              <Link to="/week" className="link">Open the week</Link>
            </div>
            <WeekPreview week={week} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function Home() {
  return (
    <WeekLoader allowEmpty noRail>
      {(w) => (w.hasWeek ? <ExistingWeek week={w} /> : <NewAccount />)}
    </WeekLoader>
  );
}

export { PageFrame };
