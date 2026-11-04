import { useActionMutation } from "@agent-native/core/client/hooks";
import { useState } from "react";

import type { WeekView } from "../../../server/lib/week-view";
import { btnDanger, btnPrimary, btnSecondary, errText, inputCls, nextMonday } from "./format";

interface StaffRow {
  id?: string;
  name: string;
  roles: string;
  maxShifts: string;
  hourlyRate: string;
  overtimeAfterHours: string;
}
interface PatternRow {
  name: string;
  role: string;
  start: string;
  end: string;
  days: number[];
  count: string;
}

// Shown Monday first; values are weekday numbers (0 = Sunday).
const DAYS: [string, number][] = [
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
  ["Sun", 0],
];

const blankStaff = (): StaffRow => ({ name: "", roles: "", maxShifts: "5", hourlyRate: "", overtimeAfterHours: "" });
const blankPattern = (): PatternRow => ({
  name: "",
  role: "",
  start: "11:00",
  end: "16:00",
  days: [1, 2, 3, 4, 5, 6, 0],
  count: "1",
});

export function SetupForm({
  existing,
  onDone,
  onCancel,
}: {
  existing: WeekView | null;
  onDone: () => void;
  onCancel: (() => void) | null;
}) {
  const editing = Boolean(existing?.hasWeek && !existing.week?.isSample);
  const replacingSample = Boolean(existing?.week?.isSample);
  const [weekStart, setWeekStart] = useState(editing && existing?.setup ? existing.setup.weekStart : nextMonday());
  const [staff, setStaff] = useState<StaffRow[]>(
    editing && existing
      ? existing.staff.map((s) => ({
          id: s.id,
          name: s.name,
          roles: s.roles.join(", "),
          maxShifts: String(s.maxShifts),
          hourlyRate: s.hourlyRate === null ? "" : String(s.hourlyRate),
          overtimeAfterHours: s.overtimeAfterHours === null ? "" : String(s.overtimeAfterHours),
        }))
      : [blankStaff()],
  );
  const [pattern, setPattern] = useState<PatternRow[]>(
    editing && existing?.setup
      ? existing.setup.pattern.map((p) => ({
          name: p.name,
          role: p.role,
          start: p.start,
          end: p.end,
          days: p.days,
          count: String(p.count),
        }))
      : [blankPattern()],
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState<string | null>(null);
  const save = useActionMutation("save-setup");

  function patchStaff(i: number, patch: Partial<StaffRow>) {
    setStaff((rows) => rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }
  function patchPattern(i: number, patch: Partial<PatternRow>) {
    setPattern((rows) => rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  function submit(confirmReplace: boolean) {
    setProblem(null);
    for (const [i, s] of staff.entries()) {
      if (!s.name.trim()) return setProblem(`Person ${i + 1} needs a name.`);
      if (!s.roles.split(",").some((r) => r.trim())) return setProblem(`${s.name} needs at least one role, like cook or server.`);
      if (!Number.isInteger(Number(s.maxShifts)) || s.maxShifts === "") return setProblem(`${s.name}: max shifts must be a whole number.`);
    }
    for (const [i, p] of pattern.entries()) {
      if (!p.name.trim()) return setProblem(`Shift ${i + 1} needs a name.`);
      if (!p.role.trim()) return setProblem(`"${p.name}" needs a role.`);
      if (p.days.length === 0) return setProblem(`"${p.name}" needs at least one day.`);
      if (p.start === p.end) return setProblem(`"${p.name}" starts and ends at the same time.`);
    }
    save.mutate(
      {
        weekStart,
        staff: staff.map((s) => ({
          ...(s.id ? { id: s.id } : {}),
          name: s.name.trim(),
          roles: s.roles.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean),
          maxShifts: Number(s.maxShifts),
          ...(s.hourlyRate.trim() ? { hourlyRate: Math.round(Number(s.hourlyRate)) } : {}),
          ...(s.overtimeAfterHours.trim() ? { overtimeAfterHours: Math.round(Number(s.overtimeAfterHours)) } : {}),
        })),
        pattern: pattern.map((p) => ({
          name: p.name.trim(),
          role: p.role.trim().toLowerCase(),
          start: p.start,
          end: p.end,
          days: p.days,
          count: Math.max(1, Math.round(Number(p.count) || 1)),
        })),
        confirmReplace,
      },
      {
        onSuccess: () => onDone(),
        onError: (err) => {
          const msg = errText(err, "Couldn't save your setup. Nothing was changed.");
          if (/confirm/i.test(msg)) {
            setConfirmText(msg);
          } else {
            setProblem(msg);
          }
        },
      },
    );
  }

  return (
    <form
      className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      aria-label="Set up my restaurant"
    >
      <div>
        <h1 className="text-xl font-semibold">{editing ? "Edit staff and shifts" : "Set up my restaurant"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your people, then describe a typical week. You can change both later.
        </p>
      </div>

      <label className="block text-sm">
        <span className="font-medium">Week starts on</span>
        <input type="date" required className={`${inputCls} mt-1 max-w-48`} value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
      </label>

      <section aria-labelledby="staff-h" className="space-y-3">
        <h2 id="staff-h" className="font-medium">Your staff</h2>
        {staff.map((s, i) => (
          <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6" data-testid="staff-setup-row">
            <label className="text-xs sm:col-span-2">
              Name
              <input className={inputCls} value={s.name} onChange={(e) => patchStaff(i, { name: e.target.value })} aria-label={`Person ${i + 1} name`} />
            </label>
            <label className="text-xs sm:col-span-2">
              Roles (comma separated)
              <input className={inputCls} placeholder="cook, server" value={s.roles} onChange={(e) => patchStaff(i, { roles: e.target.value })} aria-label={`Person ${i + 1} roles`} />
            </label>
            <label className="text-xs">
              Max shifts / week
              <input className={inputCls} inputMode="numeric" value={s.maxShifts} onChange={(e) => patchStaff(i, { maxShifts: e.target.value })} aria-label={`Person ${i + 1} max shifts`} />
            </label>
            <label className="text-xs">
              Hourly rate (optional)
              <input className={inputCls} inputMode="numeric" value={s.hourlyRate} onChange={(e) => patchStaff(i, { hourlyRate: e.target.value })} aria-label={`Person ${i + 1} hourly rate`} />
            </label>
            <label className="text-xs sm:col-span-2">
              Overtime after (hours a week, optional)
              <input className={inputCls} inputMode="numeric" value={s.overtimeAfterHours} onChange={(e) => patchStaff(i, { overtimeAfterHours: e.target.value })} aria-label={`Person ${i + 1} overtime hours`} />
            </label>
            <div className="flex items-end sm:col-span-4 sm:justify-end">
              {staff.length > 1 ? (
                <button type="button" className={btnDanger} onClick={() => setStaff((r) => r.filter((_, k) => k !== i))}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        ))}
        <button type="button" className={btnSecondary} onClick={() => setStaff((r) => [...r, blankStaff()])}>
          Add a person
        </button>
      </section>

      <section aria-labelledby="pattern-h" className="space-y-3">
        <h2 id="pattern-h" className="font-medium">A typical week</h2>
        <p className="text-sm text-muted-foreground">
          One line per kind of shift, for example "Dinner server, server, 17:00 to 23:00, Mon to Sat, 2 people". A shift that ends at or before its start runs past midnight.
        </p>
        {pattern.map((p, i) => (
          <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-6" data-testid="pattern-setup-row">
            <label className="text-xs sm:col-span-2">
              Shift name
              <input className={inputCls} value={p.name} onChange={(e) => patchPattern(i, { name: e.target.value })} aria-label={`Shift ${i + 1} name`} />
            </label>
            <label className="text-xs sm:col-span-2">
              Role needed
              <input className={inputCls} placeholder="server" value={p.role} onChange={(e) => patchPattern(i, { role: e.target.value })} aria-label={`Shift ${i + 1} role`} />
            </label>
            <label className="text-xs">
              Start
              <input type="time" className={inputCls} value={p.start} onChange={(e) => patchPattern(i, { start: e.target.value })} aria-label={`Shift ${i + 1} start`} />
            </label>
            <label className="text-xs">
              End
              <input type="time" className={inputCls} value={p.end} onChange={(e) => patchPattern(i, { end: e.target.value })} aria-label={`Shift ${i + 1} end`} />
            </label>
            <fieldset className="sm:col-span-4">
              <legend className="text-xs">Days</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {DAYS.map(([label, n]) => (
                  <label key={n} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={p.days.includes(n)}
                      onChange={(e) =>
                        patchPattern(i, { days: e.target.checked ? [...p.days, n] : p.days.filter((d) => d !== n) })
                      }
                      aria-label={`Shift ${i + 1} ${label}`}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-xs">
              How many people
              <input className={inputCls} inputMode="numeric" value={p.count} onChange={(e) => patchPattern(i, { count: e.target.value })} aria-label={`Shift ${i + 1} people`} />
            </label>
            <div className="flex items-end justify-end">
              {pattern.length > 1 ? (
                <button type="button" className={btnDanger} onClick={() => setPattern((r) => r.filter((_, k) => k !== i))}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        ))}
        <button type="button" className={btnSecondary} onClick={() => setPattern((r) => [...r, blankPattern()])}>
          Add a shift
        </button>
      </section>

      {problem ? (
        <p role="alert" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}

      {confirmText !== null ? (
        <div role="alertdialog" aria-label="Confirm replace" className="rounded-lg border border-destructive p-3 text-sm">
          <p>
            {confirmText}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={btnDanger} disabled={save.isPending} onClick={() => submit(true)}>
              {save.isPending ? "Replacing..." : "Yes, replace it"}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setConfirmText(null)}>
              No, keep what I have
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {confirmText === null ? (
          <button type="submit" className={btnPrimary} disabled={save.isPending}>
            {save.isPending ? "Saving..." : editing ? "Save changes" : "Save and continue"}
          </button>
        ) : null}
        {onCancel ? (
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
      </div>
      {replacingSample ? (
        <p className="text-xs text-muted-foreground">
          You are replacing the sample restaurant. You will be asked to confirm before anything is removed.
        </p>
      ) : null}
    </form>
  );
}
