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

// 44px tall touch targets on phones, 36px from sm up. Primary is the one filled button.
const btnBase =
  "inline-flex min-h-11 items-center justify-center rounded-sm px-4 text-base font-semibold sm:min-h-9 sm:text-sm disabled:cursor-not-allowed disabled:opacity-60";
export const btnPrimary = `${btnBase} bg-primary text-primary-foreground hover:bg-primary/90`;
export const btnSecondary = `${btnBase} border border-input bg-card text-foreground hover:bg-accent`;
export const btnDanger = `${btnBase} border border-destructive bg-card text-destructive hover:bg-problem-soft`;
export const btnLink =
  "inline-flex min-h-11 items-center px-1 text-base font-medium text-foreground underline underline-offset-4 hover:text-primary sm:min-h-9 sm:text-sm";
export const inputCls =
  "w-full min-h-11 rounded-sm border border-input bg-card px-2 py-1.5 text-base text-foreground sm:min-h-9 sm:text-sm";
export const sectionTitle = "text-xl font-bold leading-tight";
export const subTitle = "text-base font-bold";

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
