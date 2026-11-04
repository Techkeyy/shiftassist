import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { Rule } from "../../lib/solver/index";
import { getDb } from "../db/index.js";
import { rules, staff, weeks } from "../db/schema.js";
import { longDate, refuse } from "./assignments.js";

export const MAX_RULES_PER_OWNER = 300;
export const MAX_RULES_PER_CALL = 60;
export const MAX_SOURCE_LENGTH = 500;

const DAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
  .describe("A calendar date, YYYY-MM-DD, taken from the week on the board.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM, 24 hour");

/** The rule fields shared by propose-rules (agent) and save-rule (manager). */
export const ruleFields = {
  staffId: z
    .string()
    .optional()
    .describe("Id of the person, from get-week staff[].id. Give this OR staffName."),
  staffName: z
    .string()
    .max(80)
    .optional()
    .describe(
      "The person's name exactly as the message wrote it (e.g. 'Maya'). It is matched to the staff list; if it matches nobody (or several people) the card is flagged for the manager.",
    ),
  kind: z
    .enum(["unavailable", "no_double", "max_shifts", "min_rest"])
    .describe(
      "unavailable = cannot (hard) or would rather not (soft) work certain days / dates / times; no_double = at most one shift a day; max_shifts = at most N shifts this week; min_rest = at least N hours between shifts.",
    ),
  severity: z
    .enum(["hard", "soft"])
    .describe("hard = must never be broken (can't, never, medical, school run). soft = a preference (would rather, prefer, if possible)."),
  days: z
    .array(z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]))
    .optional()
    .describe("For unavailable: the weekdays it applies to, e.g. ['fri'] for 'every Friday'."),
  from: date.optional().describe("For unavailable: first date it applies to (inclusive). For a one-off day set from and until to the same date."),
  until: date.optional().describe("For unavailable: last date it applies to (inclusive)."),
  afterTime: time.optional().describe("For unavailable: can't work from this time on (e.g. '17:00' for 'not evenings')."),
  beforeTime: time.optional().describe("For unavailable: can't work before this time (e.g. '12:00' for 'not mornings')."),
  max: z.number().int().min(0).max(14).optional().describe("For max_shifts: the most shifts per week."),
  hours: z.number().min(0).max(48).optional().describe("For min_rest: the least hours between two shifts."),
};

const ruleObject = z.object(ruleFields);
export type RuleFieldsInput = z.infer<typeof ruleObject>;

export interface RuleDetails {
  [key: string]: unknown;
}

/** Turns the input fields into the solver's kind-specific fields, or says what is missing. */
export function toDetails(input: RuleFieldsInput): { details: RuleDetails } | { problem: string } {
  switch (input.kind) {
    case "unavailable": {
      const details: RuleDetails = {};
      if (input.days?.length) details.weekdays = [...new Set(input.days.map((d) => DAY_INDEX[d]!))].sort();
      if (input.from) details.from = input.from;
      if (input.until) details.until = input.until;
      if (input.afterTime) details.afterTime = input.afterTime;
      if (input.beforeTime) details.beforeTime = input.beforeTime;
      if (Object.keys(details).length === 0) {
        return { problem: "It doesn't say which days, dates or times." };
      }
      if (input.from && input.until && input.from > input.until) {
        return { problem: "The dates are the wrong way round." };
      }
      return { details };
    }
    case "no_double":
      return { details: {} };
    case "max_shifts":
      return input.max === undefined ? { problem: "It doesn't say how many shifts." } : { details: { max: input.max } };
    case "min_rest":
      return input.hours === undefined ? { problem: "It doesn't say how many hours of rest." } : { details: { hours: input.hours } };
  }
}

function fmtDate(d: string): string {
  return longDate(d);
}

/** Plain English for a rule, without the model. `name` is the staff member's name. */
export function ruleText(
  r: { kind: string; severity: "hard" | "soft"; details: RuleDetails },
  name: string,
): string {
  const d = r.details as {
    weekdays?: number[];
    from?: string;
    until?: string;
    afterTime?: string;
    beforeTime?: string;
    max?: number;
    hours?: number;
  };
  const soft = r.severity === "soft";
  switch (r.kind) {
    case "unavailable": {
      let what: string;
      if (d.afterTime && d.beforeTime) what = `before ${d.beforeTime} or after ${d.afterTime}`;
      else if (d.afterTime) what = `after ${d.afterTime}`;
      else if (d.beforeTime) what = `before ${d.beforeTime}`;
      else what = "";
      const parts: string[] = [];
      if (d.weekdays?.length) {
        parts.push(`on ${[...d.weekdays].sort().map((w) => DAY_NAMES[w]).join(", ")}`);
      }
      if (d.from && d.until) {
        parts.push(d.from === d.until ? `on ${fmtDate(d.from)}` : `from ${fmtDate(d.from)} to ${fmtDate(d.until)}`);
      } else if (d.from) parts.push(`from ${fmtDate(d.from)}`);
      else if (d.until) parts.push(`until ${fmtDate(d.until)}`);
      const verb = soft ? "would rather not work" : "can't work";
      return `${name} ${verb}${what ? " " + what : ""}${parts.length ? " " + parts.join(" ") : ""}.`;
    }
    case "no_double":
      return `${name} ${soft ? "would rather work" : "works"} at most one shift a day.`;
    case "max_shifts":
      return `${name} ${soft ? "would rather work" : "works"} at most ${d.max} shifts this week.`;
    case "min_rest":
      return `${name} ${soft ? "would like" : "needs"} at least ${d.hours} hours between shifts.`;
    default:
      return `${name}: rule not understood.`;
  }
}

export interface RuleCard {
  id: string;
  staffId: string;
  staffName: string;
  severity: "hard" | "soft";
  kind: string;
  details: RuleDetails;
  status: "proposed" | "confirmed";
  source: string | null;
  flag: string | null;
  text: string;
}

export async function listRuleCards(owner: string): Promise<RuleCard[]> {
  const db = getDb();
  const [staffRows, ruleRows] = await Promise.all([
    db.select().from(staff).where(eq(staff.ownerEmail, owner)),
    db.select().from(rules).where(eq(rules.ownerEmail, owner)),
  ]);
  const names = new Map(staffRows.map((s) => [s.id, s.name]));
  return ruleRows
    .map((r) => {
      const details = JSON.parse(r.details) as RuleDetails;
      const person = names.get(r.staffId);
      const nameForText = person ?? (typeof details.staffNameAsWritten === "string" ? details.staffNameAsWritten : "Someone");
      return {
        id: r.id,
        staffId: r.staffId,
        staffName: person ?? "",
        severity: r.severity,
        kind: r.kind,
        details,
        status: r.status,
        source: r.source,
        flag: r.flag,
        text:
          r.kind === "note"
            ? noteText(r.source ?? "", details, person ?? null)
            : r.flag && r.kind === "unclear"
              ? `Not understood: ${r.source ?? ""}`
              : ruleText({ kind: r.kind, severity: r.severity, details }, nameForText),
      };
    })
    .sort((a, b) => (a.status === b.status ? a.id.localeCompare(b.id) : a.status === "proposed" ? -1 : 1));
}

type StaffRow = { id: string; name: string };

/** Matches a name as written in a message to one person: full name, then first name, then a unique prefix. */
export function resolveStaff(
  all: StaffRow[],
  written: string,
): { ok: true; staff: StaffRow } | { ok: false; reason: string } {
  const w = written.trim().toLowerCase();
  if (!w) return { ok: false, reason: "No name was given." };
  const exact = all.filter((s) => s.name.toLowerCase() === w);
  if (exact.length === 1) return { ok: true, staff: exact[0]! };
  const firstName = all.filter((s) => s.name.toLowerCase().split(/\s+/)[0] === w);
  if (firstName.length === 1) return { ok: true, staff: firstName[0]! };
  const prefix = all.filter((s) => s.name.toLowerCase().startsWith(w));
  if (prefix.length === 1) return { ok: true, staff: prefix[0]! };
  const many = exact.length > 1 ? exact : firstName.length > 1 ? firstName : prefix;
  if (many.length > 1) {
    return { ok: false, reason: `"${written}" could be ${many.map((s) => s.name).join(" or ")}.` };
  }
  return { ok: false, reason: `"${written}" isn't on your staff list.` };
}

export interface ProposeResult {
  stored: number;
  notes: number;
  flagged: number;
  duplicatesSkipped: number;
  cards: { id: string; text: string; needsAPerson: boolean; flag: string | null }[];
  message: string;
}

/** What a note card says: the asker's summary if given, otherwise their own words. */
export function noteText(source: string, details: RuleDetails, name: string | null): string {
  const summary = typeof details.summary === "string" ? details.summary : "";
  return summary || `${name ? name + ": " : ""}${source}`;
}

const proposeItem = z.object({
  ...ruleFields,
  source: z
    .string()
    .min(1)
    .max(MAX_SOURCE_LENGTH)
    .describe("The staff member's ORIGINAL sentence, copied word for word from the pasted messages."),
});
export const proposeItemSchema = proposeItem;

/** A staff message that is NOT a rule (a swap request, a question, a thank-you). Kept as a note card. */
export const noteItemSchema = z.object({
  source: z
    .string()
    .min(1)
    .max(MAX_SOURCE_LENGTH)
    .describe("The staff member's ORIGINAL sentence, copied word for word."),
  staffName: z.string().max(80).optional().describe("Who wrote it or who it is about, as written. Optional."),
  summary: z.string().max(200).optional().describe("One plain sentence on what they are asking. Optional."),
});
export type NoteItem = z.infer<typeof noteItemSchema>;
export const NOTE_FLAG = "This is not a rule. It never affects the schedule. Dismiss it, or turn it into a rule.";
export type ProposeItem = z.infer<typeof proposeItem>;

/** Stores proposed rules. Nothing proposed here is ever used by the solver until confirmed. */
export async function proposeRules(
  owner: string,
  items: ProposeItem[],
  noteItems: NoteItem[] = [],
): Promise<ProposeResult> {
  if (items.length + noteItems.length > MAX_RULES_PER_CALL) {
    refuse(`That is too many rules at once (limit ${MAX_RULES_PER_CALL}). Send them in smaller batches.`, "too_many");
  }
  return getDb().transaction(async (tx) => {
    const [week] = await tx.select().from(weeks).where(eq(weeks.ownerEmail, owner));
    if (!week) refuse("There is no week yet. Set up your restaurant first.", "no_week");
    const staffRows = await tx.select().from(staff).where(eq(staff.ownerEmail, owner));
    const existing = await tx.select().from(rules).where(eq(rules.ownerEmail, owner));
    if (existing.length + items.length + noteItems.length > MAX_RULES_PER_OWNER) {
      refuse(`You already have ${existing.length} rules; the limit is ${MAX_RULES_PER_OWNER}.`, "too_many");
    }
    const seen = new Set(existing.map((r) => `${r.staffId}|${r.severity}|${r.kind}|${r.details}`));
    const out: ProposeResult["cards"] = [];
    let flagged = 0;
    let dupes = 0;
    for (const item of items) {
      let staffId = "";
      let flag: string | null = null;
      let person: StaffRow | undefined;
      if (item.staffId) {
        person = staffRows.find((s) => s.id === item.staffId);
        if (!person) flag = "That person isn't on your staff list.";
      } else if (item.staffName) {
        const hit = resolveStaff(staffRows, item.staffName);
        if (hit.ok) person = hit.staff;
        else flag = hit.reason;
      } else {
        flag = "The message doesn't say who this is about.";
      }
      if (person) staffId = person.id;

      const built = toDetails(item);
      let kind: string = item.kind;
      let details: RuleDetails = {};
      if ("problem" in built) {
        flag = flag ? `${flag} ${built.problem}` : built.problem;
        kind = "unclear";
      } else {
        details = built.details;
      }
      if (!person && item.staffName) details = { ...details, staffNameAsWritten: item.staffName };

      const key = `${staffId}|${item.severity}|${kind}|${JSON.stringify(details)}`;
      if (!flag && seen.has(key)) {
        dupes++;
        continue;
      }
      seen.add(key);
      const id = `ru_${crypto.randomUUID()}`;
      await tx.insert(rules).values({
        id,
        ownerEmail: owner,
        staffId,
        severity: item.severity,
        kind,
        details: JSON.stringify(details),
        source: item.source.trim(),
        status: "proposed",
        flag,
      });
      if (flag) flagged++;
      out.push({
        id,
        needsAPerson: !person,
        flag,
        text:
          kind === "unclear"
            ? `Not understood: ${item.source.trim()}`
            : ruleText({ kind, severity: item.severity, details }, person?.name ?? item.staffName ?? "Someone"),
      });
    }
    // Messages that are not rules become flagged note cards. They are stored with a kind the
    // solver does not know, can never be confirmed as they stand, and are only turned into a
    // rule when the manager edits and saves them.
    const seenNotes = new Set(
      existing.filter((r) => r.kind === "note").map((r) => (r.source ?? "").trim().toLowerCase()),
    );
    let notes = 0;
    for (const n of noteItems) {
      const source = n.source.trim();
      const dedupe = source.toLowerCase();
      if (seenNotes.has(dedupe)) {
        dupes++;
        continue;
      }
      seenNotes.add(dedupe);
      const person = n.staffName ? resolveStaff(staffRows, n.staffName) : null;
      const id = `ru_${crypto.randomUUID()}`;
      const details: RuleDetails = n.summary ? { summary: n.summary.trim() } : {};
      await tx.insert(rules).values({
        id,
        ownerEmail: owner,
        staffId: person?.ok ? person.staff.id : "",
        severity: "soft",
        kind: "note",
        details: JSON.stringify(details),
        source,
        status: "proposed",
        flag: NOTE_FLAG,
      });
      notes++;
      out.push({
        id,
        needsAPerson: false,
        flag: NOTE_FLAG,
        text: noteText(source, details, person?.ok ? person.staff.name : (n.staffName ?? null)),
      });
    }
    return {
      stored: out.length - notes,
      notes,
      flagged,
      duplicatesSkipped: dupes,
      cards: out,
      message:
        `${out.length - notes} proposed rule(s) are waiting for the manager to confirm.` +
        (notes ? ` ${notes} message(s) were not rules and are kept as notes under "Needs your eye"; they do not affect the schedule.` : "") +
        (flagged ? ` ${flagged} need attention (shown flagged on the cards).` : "") +
        (dupes ? ` ${dupes} duplicate(s) skipped.` : ""),
    };
  });
}

/** Confirms proposed rules (the ones named, or all). A flagged rule can't be confirmed until edited. */
export async function confirmRules(
  owner: string,
  input: { ids?: string[] | undefined; all?: boolean | undefined },
): Promise<{ confirmed: number; stillFlagged: { id: string; flag: string }[] }> {
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(rules)
      .where(and(eq(rules.ownerEmail, owner), eq(rules.status, "proposed")));
    const wanted = input.all ? rows : rows.filter((r) => input.ids?.includes(r.id));
    if (!input.all && (!input.ids || input.ids.length === 0)) {
      refuse("Say which rules to confirm, or confirm all.", "nothing_selected");
    }
    const ok = wanted.filter((r) => !r.flag && r.staffId);
    const flagged = wanted.filter((r) => r.flag || !r.staffId);
    if (ok.length) {
      await tx
        .update(rules)
        .set({ status: "confirmed" })
        .where(and(eq(rules.ownerEmail, owner), inArray(rules.id, ok.map((r) => r.id))));
    }
    if (!input.all && ok.length === 0 && flagged.length > 0) {
      refuse(
        flagged.every((r) => r.kind === "note")
          ? "That is a note, not a rule. Turn it into a rule first, or dismiss it."
          : "That rule needs a person or more detail first. Edit it, then confirm.",
        "rule_needs_attention",
        { flagged: flagged.map((r) => ({ id: r.id, flag: r.flag })) },
      );
    }
    return {
      confirmed: ok.length,
      stillFlagged: flagged.map((r) => ({ id: r.id, flag: r.flag ?? "Needs a person." })),
    };
  });
}

/** Creates or edits a rule on the manager's say-so. It is saved as confirmed. */
export async function saveRule(
  owner: string,
  input: RuleFieldsInput & { id?: string | undefined; source?: string | undefined },
): Promise<{ id: string; text: string }> {
  return getDb().transaction(async (tx) => {
    const [week] = await tx.select().from(weeks).where(eq(weeks.ownerEmail, owner));
    if (!week) refuse("There is no week yet. Set up your restaurant first.", "no_week");
    const staffRows = await tx.select().from(staff).where(eq(staff.ownerEmail, owner));
    const person = staffRows.find((s) => s.id === input.staffId);
    if (!person) refuse("Choose which person this rule is for.", "staff_not_found");
    const built = toDetails(input);
    if ("problem" in built) refuse(built.problem, "rule_incomplete");
    const base = {
      staffId: person.id,
      severity: input.severity,
      kind: input.kind,
      details: JSON.stringify(built.details),
      status: "confirmed" as const,
      flag: null,
    };
    let id = input.id;
    if (id) {
      const [row] = await tx
        .select()
        .from(rules)
        .where(and(eq(rules.ownerEmail, owner), eq(rules.id, id)));
      if (!row) refuse("That rule doesn't exist.", "rule_not_found");
      await tx
        .update(rules)
        .set({ ...base, source: input.source ?? row.source })
        .where(and(eq(rules.ownerEmail, owner), eq(rules.id, id)));
    } else {
      const count = (await tx.select({ id: rules.id }).from(rules).where(eq(rules.ownerEmail, owner))).length;
      if (count >= MAX_RULES_PER_OWNER) refuse(`The limit is ${MAX_RULES_PER_OWNER} rules.`, "too_many");
      id = `ru_${crypto.randomUUID()}`;
      await tx.insert(rules).values({
        id,
        ownerEmail: owner,
        ...base,
        source: input.source?.trim() || "Added by hand",
      });
    }
    return { id, text: ruleText({ kind: input.kind, severity: input.severity, details: built.details }, person.name) };
  });
}

export async function deleteRule(owner: string, id: string): Promise<{ deleted: boolean }> {
  const db = getDb();
  const rows = await db
    .select({ id: rules.id })
    .from(rules)
    .where(and(eq(rules.ownerEmail, owner), eq(rules.id, id)));
  if (rows.length === 0) refuse("That rule doesn't exist.", "rule_not_found");
  await db.delete(rules).where(and(eq(rules.ownerEmail, owner), eq(rules.id, id)));
  return { deleted: true };
}

export type { Rule };
