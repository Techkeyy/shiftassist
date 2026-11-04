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

// Styles live in public/staff-page.css (kept out of the page so the page text stays free of at-signs).
const CSS_HREF = "/staff-page.css";

const ZIG = `<svg class="zig" viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true"><rect width="100%" height="10" fill="url(#z)"/></svg>`;
const MARK = `<svg width="20" height="24" viewBox="0 0 24 28" aria-hidden="true" fill="currentColor"><path d="M4 5h16v19l-2.67-2.5L14.67 24 12 21.5 9.33 24 6.67 21.5 4 24z" opacity=".2"/><path d="M4 5h16v19l-2.67-2.5L14.67 24 12 21.5 9.33 24 6.67 21.5 4 24z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 11.5h7M8.5 15.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M7 1.5h10v6.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><rect x="10.4" y="3.6" width="3.2" height="3" rx=".6" fill="var(--card)"/></svg>`;

/** A phone-friendly page that needs no JavaScript and no login. Every string is escaped. */
export function renderPublicWeekHtml(w: PublicWeek): string {
  const days = w.days
    .map(
      (d) => `<section class="sheet"><h3>${esc(d.label)}</h3>${d.shifts
        .map(
          (s) =>
            `<div class="row"><span>${esc(s.label)} <span class="t">${esc(s.start)}-${esc(s.end)}</span></span>${
              s.person ? `<strong>${esc(s.person)}</strong>` : `<span class="open">Open</span>`
            }</div>`,
        )
        .join("")}</section>`,
    )
    .join("");
  const find = w.people.map((p, i) => `<li><a href="#p${i}">${esc(p.name)}</a></li>`).join("");
  const people = w.people
    .map(
      (p, i) => `<section class="sheet person" id="p${i}"><h3>${esc(p.name)}</h3>${p.shifts
        .map(
          (s) =>
            `<div class="row"><span>${esc(s.day)}</span><span>${esc(s.label)} <span class="t">${esc(s.start)}-${esc(s.end)}</span></span></div>`,
        )
        .join("")}${p.shifts
        .map(
          (s) =>
            `<details class="rc"><summary>Why ${esc(s.day)}, ${esc(s.label)}?</summary><div class="receipt"><p class="head">${esc(p.name)} has this shift because</p><span class="t">${esc(s.label)} ${esc(s.start)}-${esc(s.end)}</span><ul>${s.reasons
              .map((r) => `<li>${esc(r)}</li>`)
              .join("")}</ul>${ZIG}</div></details>`,
        )
        .join("")}<a class="back" href="#find">Back to names</a></section>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(w.name)}</title><link rel="stylesheet" href="${CSS_HREF}"></head><body><svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><pattern id="z" width="12" height="10" patternUnits="userSpaceOnUse"><polyline points="0,-2 6,9 12,-2" fill="var(--card)" stroke="var(--rs,var(--rule-strong))" stroke-width="1.2"/></pattern></defs></svg><main><span class="brand">${MARK}ShiftAssist</span><h1>${esc(w.name)}</h1>${
    w.isSample ? `<p><span class="tag">SAMPLE, not a real restaurant</span></p>` : ""
  }<p class="muted">Week of ${esc(longDate(w.startDate))}. This page always shows the current rota.</p><h2 id="find">Find your name</h2>${
    find ? `<ul class="find">${find}</ul>` : `<p class="muted">Nobody is on a shift yet.</p>`
  }<h2 id="days">The whole week</h2>${days}<h2 id="people">Each person, and why</h2>${people || `<p class="muted">Nobody is on a shift yet.</p>`}</main></body></html>`;
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
