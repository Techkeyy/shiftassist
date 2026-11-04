import { explainShift, findCover } from "../../lib/solver/index";
import { getDb } from "../db/index.js";
import { describeSlot, loadSchedule, refuse } from "./assignments.js";

export interface ShiftExplanation {
  slotId: string;
  description: string;
  staffId: string | null;
  staffName: string | null;
  locked: boolean;
  /** The engine's own statements about this shift. */
  reasons: string[];
  /** Everyone else on the team: could they have had it, and what blocks them. */
  others: {
    staffId: string;
    name: string;
    allowed: boolean;
    blockedBy: string[];
    wouldBreakSoft: string[];
  }[];
  /** A plain text version for the agent. Built only from the fields above. */
  summary: string;
}

export async function explainShiftView(owner: string, slotId: string): Promise<ShiftExplanation> {
  const data = await loadSchedule(getDb(), owner);
  const slot = data.input.slots.find((s) => s.id === slotId);
  if (!slot) refuse("That shift doesn't exist in your week.", "slot_not_found");
  const trace = explainShift(data.input, data.assignments, slotId);
  const holder = trace.staffId ? data.input.staff.find((s) => s.id === trace.staffId) : undefined;
  // "Who else could have had it": ask the engine about the shift as if it were free, so
  // nobody is blocked merely because the current holder is standing on it.
  const freed = explainShift(
    data.input,
    data.assignments.filter((a) => a.slotId !== slotId),
    slotId,
  );
  const others = freed.alternatives
    .filter((a) => a.staffId !== trace.staffId)
    .map((a) => ({
      staffId: a.staffId,
      name: a.name,
      allowed: a.allowed,
      blockedBy: a.blockedBy,
      wouldBreakSoft: a.wouldBreakSoft,
    }))
    .sort((a, b) => Number(b.allowed) - Number(a.allowed) || a.name.localeCompare(b.name));
  const description = describeSlot(slot);
  const lines = [
    `Shift: ${description}. ${holder ? `Worked by ${holder.name}${trace.locked ? " (locked)" : ""}.` : "Nobody is on it."}`,
    "Engine reasons:",
    ...trace.reasons.map((r) => `- ${r}`),
    "Other people:",
    ...others.map(
      (o) =>
        `- ${o.name}: ${o.allowed ? "could have worked it" : "blocked"}${o.blockedBy.length ? ` (${o.blockedBy.join(" ")})` : ""}${o.wouldBreakSoft.length ? ` Would break a soft rule: ${o.wouldBreakSoft.join(" ")}` : ""}`,
    ),
  ];
  return {
    slotId,
    description,
    staffId: trace.staffId,
    staffName: holder?.name ?? null,
    locked: trace.locked,
    reasons: trace.reasons,
    others,
    summary: lines.join("\n"),
  };
}

export interface CoverOptions {
  slotId: string;
  description: string;
  absentStaffId: string;
  absentName: string;
  options: {
    staffId: string;
    name: string;
    reasons: string[];
    softViolations: string[];
    overtimeCost: number;
    shiftsAfter: number;
    closesAfter: number;
  }[];
  /** Why people with the right role cannot cover. Shown, in full, when nobody can. */
  blocked: { staffId: string; name: string; blockedBy: string[] }[];
  summary: string;
}

/** Ranked cover options from the engine. The person who can't make it is never an option. */
export async function findCoverView(owner: string, slotId: string): Promise<CoverOptions> {
  const data = await loadSchedule(getDb(), owner);
  const slot = data.input.slots.find((s) => s.id === slotId);
  if (!slot) refuse("That shift doesn't exist in your week.", "slot_not_found");
  const current = data.assignments.find((a) => a.slotId === slotId);
  if (!current) refuse("Nobody is on that shift, so there is no one to cover for.", "slot_not_assigned");
  const absent = data.input.staff.find((s) => s.id === current.staffId)!;

  const options = findCover(data.input, data.assignments, slotId)
    .filter((o) => o.staffId !== absent.id)
    .map((o) => ({
      staffId: o.staffId,
      name: o.name,
      reasons: o.reasons,
      softViolations: o.softViolations,
      overtimeCost: o.overtimeCost,
      shiftsAfter: o.shiftsAfter,
      closesAfter: o.closesAfter,
    }));

  const without = data.assignments.filter((a) => a.slotId !== slotId);
  const trace = explainShift(data.input, without, slotId);
  const okIds = new Set(options.map((o) => o.staffId));
  const blocked = trace.alternatives
    .filter((a) => a.staffId !== absent.id && !okIds.has(a.staffId))
    .map((a) => ({ staffId: a.staffId, name: a.name, blockedBy: a.blockedBy }));

  const description = describeSlot(slot);
  const summary = options.length
    ? `${absent.name} can't make the ${description} shift. Cover options, best first: ` +
      options
        .map(
          (o, i) =>
            `${i + 1}. ${o.name} (${o.shiftsAfter} shifts after, ${o.closesAfter} closes${o.softViolations.length ? `, breaks a soft rule: ${o.softViolations.join(" ")}` : ""}${o.overtimeCost > 0 ? `, overtime cost ${o.overtimeCost}` : ""})`,
        )
        .join("; ")
    : `${absent.name} can't make the ${description} shift and nobody can cover it. ` +
      blocked.map((b) => `${b.name}: ${b.blockedBy.join(" ")}`).join(" ");
  return {
    slotId,
    description,
    absentStaffId: absent.id,
    absentName: absent.name,
    options,
    blocked,
    summary,
  };
}
