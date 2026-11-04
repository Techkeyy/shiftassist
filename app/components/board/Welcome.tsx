import { btnPrimary, btnSecondary } from "./format";

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
    <div className="mx-auto max-w-lg p-6 sm:p-10">
      <h1 className="text-xl font-semibold">Welcome to ShiftAssist</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Paste your staff's messages, get a fair week that keeps every rule you confirm, and cover a sick day in minutes.
        Pick how to start.
      </p>
      <div className="mt-6 grid gap-3">
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Set up my restaurant</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your staff and a typical week of shifts. Takes a few minutes.
          </p>
          <button type="button" className={`${btnPrimary} mt-3`} onClick={onSetup}>
            Set up my restaurant
          </button>
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">Try the sample restaurant</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            See how it works with made-up staff. It is clearly labelled as sample data and you can replace it later.
          </p>
          <button type="button" className={`${btnSecondary} mt-3`} disabled={loadingSample} onClick={onSample}>
            {loadingSample ? "Loading the sample..." : "Try the sample restaurant"}
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
