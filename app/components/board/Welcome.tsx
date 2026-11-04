import { Clip, RailBar, Stamp, Zig } from "./art";
import { btnPrimary, btnSecondary } from "./format";

const EXAMPLES = [
  { no: "01", said: "Can't do Fridays, school pickup.", rule: "Not available on Fridays", stamped: true },
  { no: "02", said: "Please no more than 4 shifts for me this week.", rule: "At most 4 shifts a week", stamped: false },
  { no: "03", said: "Could I skip the Sunday close if possible?", rule: "Prefers no Sunday close", stamped: false },
];

/** Static example: three tickets on a rail, in the staff's own words, one stamped. Not a result. */
function ExampleRail() {
  return (
    <figure className="example-rail m-0" aria-label="Example: three staff messages as tickets on a rail">
      <figcaption className="example-tag">Example</figcaption>
      <div className="rail-wrap">
        <RailBar />
        <ul>
          {EXAMPLES.map((t) => (
            <li key={t.no} className="ticket">
              <Clip className="ticket-clip" />
              <div className="ticket-head flex flex-wrap items-center gap-2">
                <span className="ticket-no">No. {t.no}</span>
                {t.stamped ? <Stamp /> : null}
              </div>
              <p className="ticket-source">"{t.said}"</p>
              <p className="ticket-rule">{t.rule}</p>
              <Zig />
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}

export function Welcome({
  loadingSample,
  error,
  onSample,
  onSetup,
}: {
  loadingSample: boolean;
  error: string | null;
  onSample: () => void;
  onSetup: () => void;
}) {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
      <div>
        <h1 className="display text-4xl leading-tight sm:text-5xl text-balance">Your staff's texts in. A fair week out.</h1>
        <p className="mt-4 max-w-md text-lg">
          Paste the messages your team sends you. ShiftAssist turns each one into a rule you confirm, builds the week around them, and can tell you why any shift went to the person it did.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={btnPrimary} disabled={loadingSample} onClick={onSample}>
            {loadingSample ? "Loading the sample..." : "Try the sample restaurant"}
          </button>
          <button type="button" className={btnSecondary} onClick={onSetup}>
            Set up my restaurant
          </button>
        </div>
        <p className="hint mt-3 max-w-md">
          The sample uses made-up staff and is tagged Sample. Setting up your own takes a few minutes: staff, then a typical week of shifts.
        </p>
        {error ? (
          <p role="alert" className="problem-line mt-4">
            {error}
          </p>
        ) : null}
      </div>
      <ExampleRail />
    </div>
  );
}
