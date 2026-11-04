import { useEffect, useId, useRef } from "react";

/** Flat, one-colour mark: a ticket held by a clip. */
export function Mark({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size * 1.17} viewBox="0 0 24 28" className={className} aria-hidden="true" fill="currentColor">
      <path d="M4 5h16v19l-2.67-2.5L14.67 24 12 21.5 9.33 24 6.67 21.5 4 24z" opacity="0.2" />
      <path
        d="M4 5h16v19l-2.67-2.5L14.67 24 12 21.5 9.33 24 6.67 21.5 4 24z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8.5 11.5h7M8.5 15.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <path d="M7 1.5h10v6.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" />
      <rect x="10.4" y="3.6" width="3.2" height="3" rx="0.6" fill="hsl(var(--card))" />
    </svg>
  );
}

/** A clip. Closed and filled = done or holding; open outline = not yet. */
export function Clip({ closed = true, className, height = 22 }: { closed?: boolean; className?: string; height?: number }) {
  return (
    <svg width={height * 0.72} height={height} viewBox="0 0 16 22" className={className} aria-hidden="true">
      {closed ? (
        <>
          <path d="M2 1.5h12v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 9.5z" fill="currentColor" />
          <rect x="6.2" y="3.8" width="3.6" height="3.4" rx="0.7" fill="hsl(var(--card))" />
          <path d="M8 11v9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M2 1.5h12v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 9.5z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="0" />
          <path d="M5 13.5l-2.5 6M11 13.5l2.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function toFrac(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const mins = h * 60 + m;
  // The arc runs from 06:00 (low on the left) to 24:00 (the moon, low on the right).
  return Math.min(1, Math.max(0, (mins - 6 * 60) / (18 * 60)));
}

/** Where a shift sits in the day: a half arc, sun side left, moon side right. */
export function DayArc({ start, end, className }: { start: string; end: string; className?: string }) {
  const cx = 18;
  const cy = 14;
  const r = 14;
  const pt = (f: number) => {
    const a = Math.PI * (1 - f);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };
  let [f0, f1] = [toFrac(start), toFrac(end)];
  // A shift that closes after midnight ends at the moon.
  if (end <= start) f1 = 1;
  const [x0, y0] = pt(f0);
  const [x1, y1] = pt(f1);
  const [bx, by] = pt(0);
  const [ex, ey] = pt(1);
  return (
    <svg width="36" height="17" viewBox="0 0 36 17" className={className} aria-hidden="true">
      <path d={`M${bx} ${by}A${r} ${r} 0 0 1 ${ex} ${ey}`} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
      <path d={`M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="butt" />
      <circle cx={bx} cy={by} r="1.6" fill="currentColor" opacity="0.5" />
      <path d={`M${ex + 0.5} ${ey - 3.2}a3.2 3.2 0 1 0 0 6.4a2.5 2.5 0 0 1 0-6.4z`} fill="currentColor" opacity="0.5" transform="translate(-2 0)" />
    </svg>
  );
}

/** A torn zigzag edge to sit under a ticket or receipt. Colour comes from CSS `color`. */
export function Zig({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={`zig ${className ?? ""}`} viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true" width="100%" height="10">
      <defs>
        <pattern id={id} width="12" height="10" patternUnits="userSpaceOnUse">
          <polyline points="0,-2 6,9 12,-2" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="miter" />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill={`url(#${id})`} />
    </svg>
  );
}

/** The rail the tickets clip onto. */
export function RailBar({ open = false }: { open?: boolean }) {
  return (
    <svg className="rail-bar" height="14" width="100%" aria-hidden="true">
      <rect x="0" y="4" width="100%" height="6" rx="3" fill="currentColor" />
      {open ? null : <rect x="0" y="4" width="100%" height="2" rx="1" fill="hsl(var(--card))" opacity="0.25" />}
    </svg>
  );
}

/** CONFIRMED rubber stamp. Rotated about 4 degrees by CSS. */
export function Stamp({ fresh, index = 0 }: { fresh?: boolean | undefined; index?: number | undefined }) {
  return (
    <svg
      className="stamp"
      data-fresh={fresh ? "true" : undefined}
      style={{ ["--i" as string]: index }}
      width="140"
      height="40"
      viewBox="0 0 140 40"
      role="img"
      aria-label="Confirmed"
    >
      <rect x="2" y="2" width="136" height="36" rx="3" fill="hsl(var(--card))" fillOpacity="0.9" stroke="currentColor" strokeWidth="2.5" />
      <rect x="6" y="6" width="128" height="28" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <text
        x="70"
        y="26"
        textAnchor="middle"
        fill="currentColor"
        style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, letterSpacing: "0.16em" }}
      >
        CONFIRMED
      </text>
    </svg>
  );
}

/** Diagonal hatching for a cell that cannot take the shift. */
export function HatchDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id="sa-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="currentColor" strokeWidth="1.6" />
        </pattern>
      </defs>
    </svg>
  );
}
export function Hatch() {
  return (
    <svg className="hatch" aria-hidden="true" focusable="false">
      <rect width="100%" height="100%" fill="url(#sa-hatch)" />
    </svg>
  );
}

/** A hand-ruled strike line through a name. */
export function Strike() {
  return (
    <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 5 L100 2.5" stroke="currentColor" strokeWidth="1.8" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const STROKE = 9;
const GROUP = 54;
function xAt(n: number): number {
  return Math.floor(n / 5) * GROUP + (n % 5) * STROKE;
}

/** Tally marks: four strokes and a slash per five. Strokes draw in when the count rises. */
export function Tally({ count, average, label, max }: { count: number; average: number; label: string; max: number }) {
  const prev = useRef(count);
  const from = prev.current;
  useEffect(() => {
    prev.current = count;
  });
  const width = xAt(Math.max(max, count, Math.ceil(average))) + GROUP * 0.4 + 8;
  const strokes: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const g = Math.floor(i / 5);
    const k = i % 5;
    const isNew = i >= from && from !== count;
    const base = g * GROUP + 4;
    if (k < 4) {
      const x = base + k * STROKE;
      strokes.push(
        <line key={i} className="tally-stroke" pathLength={1} data-new={isNew ? "true" : undefined} x1={x} y1={4} x2={x} y2={26} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />,
      );
    } else {
      strokes.push(
        <line key={i} className="tally-stroke" pathLength={1} data-new={isNew ? "true" : undefined} x1={base - 3} y1={24} x2={base + 3 * STROKE + 3} y2={6} stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />,
      );
    }
  }
  const avgX = Math.floor(average / 5) * GROUP + 4 + Math.min(average % 5, 4) * STROKE - 3;
  return (
    <svg
      className="tally-svg"
      width={width}
      height={30}
      viewBox={`0 0 ${width} 30`}
      role="img"
      aria-label={`${label}: ${count}. Team average ${average.toFixed(1)}`}
    >
      <line x1={avgX} y1={0} x2={avgX} y2={30} stroke="hsl(var(--lock))" strokeWidth="1.5" strokeDasharray="2 3" />
      {strokes}
    </svg>
  );
}
