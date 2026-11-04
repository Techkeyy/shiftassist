import type { MigrationEntry } from "@agent-native/core/db";

// Additive only. Append new entries; never edit or renumber an applied one.
export const migrations: MigrationEntry[] = [
  {
    version: 1,
    name: "shiftassist-core-tables",
    sql: `
      CREATE TABLE IF NOT EXISTS shiftassist_weeks (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        is_sample BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS shiftassist_weeks_owner_uq ON shiftassist_weeks (owner_email);
      CREATE TABLE IF NOT EXISTS shiftassist_staff (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        name TEXT NOT NULL,
        roles TEXT NOT NULL DEFAULT '[]',
        max_shifts INTEGER NOT NULL DEFAULT 5,
        hourly_rate INTEGER,
        overtime_after_hours INTEGER
      );
      CREATE INDEX IF NOT EXISTS shiftassist_staff_owner_idx ON shiftassist_staff (owner_email);
      CREATE TABLE IF NOT EXISTS shiftassist_slots (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        date TEXT NOT NULL,
        start TEXT NOT NULL,
        "end" TEXT NOT NULL,
        role TEXT NOT NULL,
        label TEXT
      );
      CREATE INDEX IF NOT EXISTS shiftassist_slots_owner_idx ON shiftassist_slots (owner_email);
      CREATE TABLE IF NOT EXISTS shiftassist_rules (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        staff_id TEXT NOT NULL,
        severity TEXT NOT NULL,
        kind TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '{}',
        source TEXT
      );
      CREATE INDEX IF NOT EXISTS shiftassist_rules_owner_idx ON shiftassist_rules (owner_email);
      CREATE TABLE IF NOT EXISTS shiftassist_assignments (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        slot_id TEXT NOT NULL,
        staff_id TEXT NOT NULL,
        locked BOOLEAN NOT NULL DEFAULT false
      );
      CREATE UNIQUE INDEX IF NOT EXISTS shiftassist_assignments_owner_slot_uq ON shiftassist_assignments (owner_email, slot_id);
    `,
  },
];

export const MIGRATIONS_TABLE = "shiftassist_migrations";
