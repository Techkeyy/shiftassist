import { Mark } from "./art";
import { btnPrimary, btnSecondary } from "./format";

/** Example drawing: an empty rail and three open clips, waiting for tickets. */
function EmptyRailScene() {
  return (
    <figure className="m-0">
      <svg viewBox="0 0 420 260" width="100%" role="img" aria-label="Example drawing: an empty rail with open clips and three outlines where tickets will hang" style={{ maxWidth: 460 }}>
        <rect x="8" y="26" width="404" height="9" rx="4.5" fill="hsl(var(--foreground))" />
        {[70, 210, 350].map((x, i) => (
          <g key={x}>
            <g transform={`translate(${x - 8} 28)`} color="hsl(var(--foreground))">
              <path d="M2 1.5h12v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 9.5z" fill="hsl(var(--background))" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5 13.5l-2.5 7M11 13.5l2.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </g>
            <path
              d={`M${x - 52} 62h104v${150 + i * 14}l-8.7 7-8.7-7-8.7 7-8.7-7-8.7 7-8.7-7-8.7 7-8.7-7-8.7 7-8.7-7-8.7 7-8.7-7z`}
              fill="none"
              stroke="hsl(var(--rule-strong))"
              strokeWidth="1.6"
              strokeDasharray="5 5"
            />
          </g>
        ))}
      </svg>
      <figcaption className="hint mt-2">Example drawing. Your staff's messages will hang here as tickets.</figcaption>
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
    <div className="mx-auto grid max-w-5xl gap-10 px-5 py-8 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
      <div>
        <div className="flex items-center gap-2">
          <Mark size={22} />
          <span className="display text-lg">ShiftAssist</span>
        </div>
        <h1 className="display mt-6 text-4xl leading-tight sm:text-5xl text-balance">Your staff's texts in. A fair week out.</h1>
        <p className="mt-4 max-w-md text-lg">
          Paste the messages your team sends you. ShiftAssist turns each one into a rule you confirm, builds the week around them, and can tell you why any shift went to the person it did.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" className={btnPrimary} onClick={onSetup}>
            Set up my restaurant
          </button>
          <button type="button" className={btnSecondary} disabled={loadingSample} onClick={onSample}>
            {loadingSample ? "Loading the sample..." : "Try the sample restaurant"}
          </button>
        </div>
        <p className="hint mt-3 max-w-md">
          The sample uses made-up staff and is labelled as sample data. Setting up your own takes a few minutes: staff, then a typical week of shifts.
        </p>
        {error ? (
          <p role="alert" className="problem-line mt-4">
            {error}
          </p>
        ) : null}
      </div>
      <EmptyRailScene />
    </div>
  );
}
