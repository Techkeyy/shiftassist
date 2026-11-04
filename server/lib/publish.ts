import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { explainShift } from "../../lib/solver/index";
import { getDb } from "../db/index.js";
import { weeks } from "../db/schema.js";
import { loadSchedule, longDate, refuse } from "./assignments.js";

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface PublishState {
  published: boolean;
  token: string | null;
  /** Path only; the browser adds the origin. */
  path: string | null;
  publishedAt: string | null;
}

export async function publishWeek(owner: string): Promise<PublishState> {
  const db = getDb();
  const [w] = await db.select().from(weeks).where(eq(weeks.ownerEmail, owner));
  if (!w) refuse("There is no week to publish yet.", "no_week");
  if (w.publishedToken) {
    return { published: true, token: w.publishedToken, path: `/s/${w.publishedToken}`, publishedAt: w.publishedAt };
  }
  const token = newToken();
  const at = new Date().toISOString();
  await db.update(weeks).set({ publishedToken: token, publishedAt: at }).where(eq(weeks.ownerEmail, owner));
  return { published: true, token, path: `/s/${token}`, publishedAt: at };
}

export async function unpublishWeek(owner: string): Promise<PublishState> {
  const db = getDb();
  const [w] = await db.select().from(weeks).where(eq(weeks.ownerEmail, owner));
  if (!w) refuse("There is no week yet.", "no_week");
  await db.update(weeks).set({ publishedToken: null, publishedAt: null }).where(eq(weeks.ownerEmail, owner));
  return { published: false, token: null, path: null, publishedAt: null };
}

/** The only shape that ever leaves the building without a login. No emails, rates or ids. */
export interface PublicWeek {
  name: string;
  isSample: boolean;
  startDate: string;
  publishedAt: string | null;
  days: {
    date: string;
    label: string;
    shifts: { label: string; start: string; end: string; person: string | null }[];
  }[];
  people: {
    name: string;
    shifts: { day: string; label: string; start: string; end: string; reasons: string[] }[];
  }[];
}

/**
 * Looks a week up by its public token. This is the one deliberately unscoped read: the token
 * is the credential. A malformed, unknown or revoked token returns null.
 */
export async function getPublicWeek(token: string): Promise<PublicWeek | null> {
  if (!TOKEN_RE.test(token)) return null;
  const db = getDb();
  const [w] = await db.select().from(weeks).where(eq(weeks.publishedToken, token));
  if (!w) return null;
  const data = await loadSchedule(db, w.ownerEmail);
  const nameOf = new Map(data.input.staff.map((s) => [s.id, s.name]));
  const holder = new Map(data.assignments.map((a) => [a.slotId, a.staffId]));
  const slots = [...data.input.slots].sort((a, b) => (a.date + a.start + a.id).localeCompare(b.date + b.start + b.id));

  const dayMap = new Map<string, PublicWeek["days"][number]>();
  for (const s of slots) {
    let day = dayMap.get(s.date);
    if (!day) {
      day = { date: s.date, label: longDate(s.date), shifts: [] };
      dayMap.set(s.date, day);
    }
    const sid = holder.get(s.id);
    day.shifts.push({ label: s.label ?? s.role, start: s.start, end: s.end, person: sid ? (nameOf.get(sid) ?? null) : null });
  }

  const peopleMap = new Map<string, PublicWeek["people"][number]>();
  for (const s of slots) {
    const sid = holder.get(s.id);
    if (!sid) continue;
    const name = nameOf.get(sid);
    if (!name) continue;
    const trace = explainShift(data.input, data.assignments, s.id);
    let p = peopleMap.get(sid);
    if (!p) {
      p = { name, shifts: [] };
      peopleMap.set(sid, p);
    }
    p.shifts.push({ day: longDate(s.date), label: s.label ?? s.role, start: s.start, end: s.end, reasons: trace.reasons });
  }

  return {
    name: w.name,
    isSample: w.isSample,
    startDate: w.startDate,
    publishedAt: w.publishedAt,
    days: [...dayMap.values()],
    people: [...peopleMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CSS = `
*{box-sizing:border-box}body{margin:0;font:16px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;background:#f6f5f1}
main{max-width:720px;margin:0 auto;padding:16px}h1{font-size:1.35rem;margin:.2em 0}h2{font-size:1.05rem;margin:1.4em 0 .4em}
.tag{display:inline-block;background:#ffe9a8;border-radius:4px;padding:2px 8px;font-size:.8rem;font-weight:600}
.muted{color:#5c5c5c;font-size:.9rem}nav a{display:inline-block;margin:6px 8px 6px 0;padding:6px 12px;border:1px solid #bbb;border-radius:999px;color:inherit;text-decoration:none;background:#fff}
.day{background:#fff;border:1px solid #ddd;border-radius:8px;padding:10px 12px;margin:10px 0}.day h3{margin:0 0 6px;font-size:1rem}
.row{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-top:1px solid #eee}.row:first-of-type{border-top:0}
.open{color:#a33;font-weight:600}details{border-top:1px solid #eee;padding:6px 0}summary{cursor:pointer}ul{margin:.4em 0 .2em 1.1em;padding:0}
`;

/** A phone-friendly page that needs no JavaScript and no login. Every string is escaped. */
export function renderPublicWeekHtml(w: PublicWeek): string {
  const days = w.days
    .map(
      (d) => `<section class="day"><h3>${esc(d.label)}</h3>${d.shifts
        .map(
          (s) =>
            `<div class="row"><span>${esc(s.label)} <span class="muted">${esc(s.start)}-${esc(s.end)}</span></span>${
              s.person ? `<strong>${esc(s.person)}</strong>` : `<span class="open">Open</span>`
            }</div>`,
        )
        .join("")}</section>`,
    )
    .join("");
  const people = w.people
    .map(
      (p) => `<section class="day"><h3>${esc(p.name)}</h3>${p.shifts
        .map(
          (s) =>
            `<details><summary>${esc(s.day)}: ${esc(s.label)} ${esc(s.start)}-${esc(s.end)}</summary><ul>${s.reasons
              .map((r) => `<li>${esc(r)}</li>`)
              .join("")}</ul></details>`,
        )
        .join("")}</section>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(w.name)}</title><style>${CSS}</style></head><body><main><h1>${esc(w.name)}</h1>${
    w.isSample ? `<p><span class="tag">SAMPLE, not a real restaurant</span></p>` : ""
  }<p class="muted">Week of ${esc(longDate(w.startDate))}. This page always shows the current rota.</p><nav><a href="#days">By day</a><a href="#people">By person</a></nav><h2 id="days">By day</h2>${days}<h2 id="people">By person, and why</h2>${people || `<p class="muted">Nobody is on a shift yet.</p>`}</main></body></html>`;
}

const hits = new Map<string, { n: number; reset: number }>();

/** Light per-address limit on public lookups: 60 a minute. Returns true when the call may go ahead. */
export function allowPublicLookup(key: string, now = Date.now()): boolean {
  const h = hits.get(key);
  if (!h || now > h.reset) {
    hits.set(key, { n: 1, reset: now + 60_000 });
    if (hits.size > 5000) hits.clear();
    return true;
  }
  h.n++;
  return h.n <= 60;
}
