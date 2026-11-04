export type Severity = "hard" | "soft";

export interface Staff {
  id: string;
  name: string;
  roles: string[];
  maxShifts: number;
  hourlyRate?: number;
  overtimeAfterHours?: number;
}

/** One slot = one person needed. An end at or before the start means the shift runs past midnight. */
export interface Slot {
  id: string;
  date: string;
  start: string;
  end: string;
  role: string;
  label?: string;
}

export interface Assignment {
  slotId: string;
  staffId: string;
  locked: boolean;
}

export type RuleKind =
  | {
      kind: "unavailable";
      from?: string;
      until?: string;
      weekdays?: number[];
      afterTime?: string;
      beforeTime?: string;
    }
  | { kind: "no_double" }
  | { kind: "max_shifts"; max: number }
  | { kind: "min_rest"; hours: number };

/** A rule is flat: the common fields plus the kind-specific fields. */
export type Rule = {
  id: string;
  staffId: string;
  severity: Severity;
  source?: string;
} & RuleKind;

export interface SchedulingInput {
  staff: Staff[];
  slots: Slot[];
  rules: Rule[];
}

export interface SolveInput extends SchedulingInput {
  assignments?: Assignment[];
}

export interface Violation {
  ruleId?: string;
  code: string;
  message: string;
}

export interface CheckResult {
  ok: boolean;
  violations: Violation[];
}

export interface Unfilled {
  slotId: string;
  reasons: string[];
}

export interface Alternative {
  staffId: string;
  name: string;
  blockedBy: string[];
  wouldBreakSoft: string[];
  allowed: boolean;
}

export interface Trace {
  slotId: string;
  staffId: string | null;
  locked: boolean;
  reasons: string[];
  alternatives: Alternative[];
}

export interface PersonFairness {
  staffId: string;
  shifts: number;
  hours: number;
  closes: number;
  weekends: number;
}

export interface FairnessAverages {
  shifts: number;
  hours: number;
  closes: number;
  weekends: number;
}

export interface Fairness {
  people: PersonFairness[];
  averages: FairnessAverages;
}

export interface LockedViolation {
  slotId: string;
  staffId: string;
  violations: Violation[];
}

export interface SolveResult {
  assignments: Assignment[];
  unfilled: Unfilled[];
  traces: Record<string, Trace>;
  fairness: Fairness;
  /** Locked assignments that break a hard rule. They are kept and flagged here. */
  lockedViolations: LockedViolation[];
}

export interface Move {
  slotId: string;
  fromStaffId: string;
  /** null when the slot was left unfilled by the repair. */
  toStaffId: string | null;
}

export interface RepairResult extends SolveResult {
  moved: Move[];
}

export interface CoverOption {
  staffId: string;
  name: string;
  allowed: true;
  softViolations: string[];
  overtimeCost: number;
  closesAfter: number;
  shiftsAfter: number;
  reasons: string[];
}
