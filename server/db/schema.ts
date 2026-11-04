import { boolean, index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Every table is private to one account: `owner_email` is set from the
 * authenticated caller, never from client input, and every query filters on it.
 */

/** One row per owner: the single week currently on the board. */
export const weeks = pgTable(
  "shiftassist_weeks",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    name: text("name").notNull(),
    startDate: text("start_date").notNull(),
    isSample: boolean("is_sample").notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("shiftassist_weeks_owner_uq").on(t.ownerEmail)],
);

export const staff = pgTable(
  "shiftassist_staff",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    name: text("name").notNull(),
    /** JSON text: string[] */
    roles: text("roles").notNull().default("[]"),
    maxShifts: integer("max_shifts").notNull().default(5),
    hourlyRate: integer("hourly_rate"),
    overtimeAfterHours: integer("overtime_after_hours"),
  },
  (t) => [index("shiftassist_staff_owner_idx").on(t.ownerEmail)],
);

export const slots = pgTable(
  "shiftassist_slots",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    date: text("date").notNull(),
    start: text("start").notNull(),
    end: text("end").notNull(),
    role: text("role").notNull(),
    label: text("label"),
  },
  (t) => [index("shiftassist_slots_owner_idx").on(t.ownerEmail)],
);

export const rules = pgTable(
  "shiftassist_rules",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    staffId: text("staff_id").notNull(),
    severity: text("severity", { enum: ["hard", "soft"] }).notNull(),
    kind: text("kind").notNull(),
    /** JSON text: the kind-specific fields of the solver Rule. */
    details: text("details").notNull().default("{}"),
    source: text("source"),
  },
  (t) => [index("shiftassist_rules_owner_idx").on(t.ownerEmail)],
);

export const assignments = pgTable(
  "shiftassist_assignments",
  {
    id: text("id").primaryKey(),
    ownerEmail: text("owner_email").notNull(),
    slotId: text("slot_id").notNull(),
    staffId: text("staff_id").notNull(),
    locked: boolean("locked").notNull().default(false),
  },
  (t) => [
    // One person per slot, per owner.
    uniqueIndex("shiftassist_assignments_owner_slot_uq").on(t.ownerEmail, t.slotId),
  ],
);
