import { actionErrorMessage } from "@agent-native/core/client/hooks";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * A shift time for a chip. "10-4" only when it is unambiguous: both ends on the hour and the
 * shift starts in the morning and ends in the afternoon or evening. Everything else, such as an
 * evening shift or a half hour, is written in full as "17:00-23:00".
 */
export function timeRange(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number) as [number, number];
  const [eh, em] = end.split(":").map(Number) as [number, number];
  if (sm === 0 && em === 0 && sh >= 6 && sh < 12 && eh > 12 && eh <= 23) {
    return `${sh}-${eh - 12}`;
  }
  return `${start}-${end}`;
}

/** The same range in a sentence: "10:00 to 16:00". */
export function timeRangeWords(start: string, end: string): string {
  return `${start} to ${end}`;
}

export function nextMonday(from = new Date()): string {
  const d = new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()));
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7));
  return d.toISOString().slice(0, 10);
}

export const btnPrimary = "btn btn-primary";
export const btnSecondary = "btn btn-secondary";
export const btnDanger = "btn btn-danger";
export const btnLink = "link";
export const inputCls = "field";

/** "Mon" and "3 Nov" for a sheet column head. */
export function dayParts(date: string): { name: string; date: string } {
  const d = new Date(`${date}T00:00:00Z`);
  return { name: DAY_NAMES[d.getUTCDay()]!, date: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` };
}

/** Human text for a failed action; never the raw framework prefix. */
export function errText(err: unknown, fallback: string): string {
  return actionErrorMessage(err) ?? fallback;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

/** A slip's time, always short enough never to clip: "10-16", "10:30-16". Full times live on the receipt. */
export function slotTime(start: string, end: string): string {
  const part = (t: string) => {
    const [h, m] = t.split(":").map(Number) as [number, number];
    return m === 0 ? String(h) : `${h}:${String(m).padStart(2, "0")}`;
  };
  return `${part(start)}-${part(end)}`;
}

/** Lunch or dinner band, from the real start time. Before 15:00 is lunch. */
export function bandOf(start: string): "lunch" | "dinner" {
  const h = Number(start.split(":")[0]);
  return h < 15 ? "lunch" : "dinner";
}

/** The data label may say "SAMPLE: ... (not your data)"; the screen shows the plain restaurant name. */
export function cleanWeekName(name: string): string {
  return name.replace(/^\s*sample:\s*/i, "").replace(/\s*\(not your data\)\s*$/i, "").trim() || name;
}

/** "Lunch cook" in a Lunch band becomes ["Lunch ", "cook"] so narrow columns can drop the band word. */
export function splitBandLabel(label: string, band: "lunch" | "dinner"): [string, string] {
  const word = band === "lunch" ? "Lunch" : "Dinner";
  if (label.toLowerCase().startsWith(`${word.toLowerCase()} `) && label.length > word.length + 1) {
    return [`${label.slice(0, word.length)} `, label.slice(word.length + 1)];
  }
  return ["", label];
}

/**
 * Shortens one of the engine's "why not" sentences for the receipt, only for the exact shapes we know,
 * and never invents a reason. Anything else comes back unchanged with `exact: true`.
 */
export function shapeReason(name: string, sentence: string): { text: string; exact: boolean } {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let m = sentence.match(new RegExp(`^${esc} is already at the limit of (\\d+) shifts?\\.$`));
  if (m) return { text: `at the ${m[1]} shift limit`, exact: false };
  m = sentence.match(new RegExp(`^${esc} doesn't have the (.+) role\\.$`));
  if (m) {
    const role = m[1]!;
    return { text: `not ${/^[aeiou]/i.test(role) ? "an" : "a"} ${role}`, exact: false };
  }
  if (new RegExp(`^${esc} is already on the .+, which overlaps this shift\\.$`).test(sentence)) {
    return { text: "already on an overlapping shift", exact: false };
  }
  if (new RegExp(`^${esc} already has a shift on .+\\.$`).test(sentence)) {
    return { text: "already has a shift that day", exact: false };
  }
  return { text: sentence, exact: true };
}

function clock12(t: string): { h: number; m: number; pm: boolean } {
  const [h, m] = t.split(":").map(Number) as [number, number];
  return { h: h % 12 === 0 ? 12 : h % 12, m, pm: h % 24 >= 12 };
}
const clockPart = (c: { h: number; m: number }) => (c.m === 0 ? String(c.h) : `${c.h}:${String(c.m).padStart(2, "0")}`);

/** A slip's time in everyday words: "10-4", "5-11", "11:30-4". Always short; the sentence form is timeWords. */
export function plainTime(start: string, end: string): string {
  return `${clockPart(clock12(start))}-${clockPart(clock12(end))}`;
}

/** "10am to 4pm", for sentences. */
export function timeWords(start: string, end: string): string {
  const a = clock12(start);
  const b = clock12(end);
  const ap = (c: typeof a) => `${clockPart(c)}${c.pm ? "pm" : "am"}`;
  return `${ap(a)} to ${ap(b)}`;
}

/** Joins names as "Sam, Priya and Maya". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "everyone has 2 or 3", or the names at the two ends when the spread is wider than one. Null when there is no data. */
function spread(people: { name: string; n: number }[], noun: string): { even: boolean; text: string } | null {
  if (people.length === 0) return null;
  const sorted = [...people].sort((a, b) => a.n - b.n);
  const lo = sorted[0]!;
  const hi = sorted[sorted.length - 1]!;
  if (hi.n - lo.n <= 1) {
    return { even: true, text: `${noun}: everyone has ${lo.n === hi.n ? lo.n : `${lo.n} or ${hi.n}`}.` };
  }
  return { even: false, text: `${noun}: ${hi.name} has ${hi.n}, ${lo.name} has ${lo.n}.` };
}

/** One true sentence about fairness, from the scheduler's own counts. Null before anything is placed. */
export function fairnessSummary(
  people: { name: string; closes: number; weekends: number }[] | undefined,
): { even: boolean; text: string } | null {
  if (!people || people.length === 0) return null;
  const c = spread(people.map((p) => ({ name: p.name, n: p.closes })), "Closing shifts");
  const w = spread(people.map((p) => ({ name: p.name, n: p.weekends })), "Weekend shifts");
  if (!c || !w) return null;
  const even = c.even && w.even;
  return { even, text: `${even ? "Shared fairly." : "Not even yet."} ${c.text} ${w.text}` };
}
