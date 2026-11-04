import { useState } from "react";

import type { WeekView } from "../../../server/lib/week-view";
import { cn } from "@/lib/utils";
import { dayLabel } from "./format";

type SlotView = WeekView["slots"][number];

export function SlotChip({
  slot,
  selected,
  changed,
  pending,
  showPerson,
  onSelect,
}: {
  slot: SlotView;
  selected: boolean;
  changed: boolean;
  pending: boolean;
  showPerson?: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-testid="shift-chip"
      data-slot-id={slot.id}
      data-changed={changed ? "true" : undefined}
      aria-pressed={selected}
      aria-label={`${slot.description}${slot.staffName ? `, ${slot.staffName}` : ", open"}${slot.locked ? ", locked" : ""}${changed ? ", changed" : ""}`}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", slot.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "cursor-grab select-none rounded-md border px-2 py-1 text-xs leading-tight active:cursor-grabbing",
        "bg-card text-card-foreground hover:bg-accent",
        changed && "border-amber-500 bg-amber-100 dark:bg-amber-950/60",
        selected && "ring-2 ring-primary",
        slot.locked && "border-l-4 border-l-primary",
        !slot.staffId && "border-dashed",
        pending && "opacity-50",
      )}
    >
      <div className="font-medium">
                {slot.label}
        {showPerson ? <span className="font-normal"> · {slot.staffName ?? "Open"}</span> : null}
      </div>
      <div className="text-muted-foreground">
        {slot.start}-{slot.end}
        {slot.locked ? " · locked" : ""}
        {changed ? " · changed" : ""}
      </div>
    </div>
  );
}

export function WeekGrid({
  week,
  selectedId,
  changedIds,
  pendingSlot,
  onSelect,
  onDropTo,
}: {
  week: WeekView;
  selectedId: string | null;
  changedIds: Set<string>;
  pendingSlot: string | null;
  onSelect: (id: string | null) => void;
  onDropTo: (slotId: string, staffId: string) => void;
}) {
  const [overCell, setOverCell] = useState<string | null>(null);
  const dates = Array.from(new Set(week.slots.map((s) => s.date))).sort();
  const cell = (staffId: string | null, date: string) => week.slots.filter((s) => s.staffId === staffId && s.date === date);
  const open = week.slots.filter((s) => !s.staffId);
  const chip = (s: SlotView) => (
    <SlotChip
      key={s.id}
      slot={s}
      selected={s.id === selectedId}
      changed={changedIds.has(s.id)}
      pending={pendingSlot === s.id}
      onSelect={() => onSelect(s.id === selectedId ? null : s.id)}
    />
  );

  return (
    <div className="w-full max-w-full overflow-x-auto rounded-lg border" data-testid="board-scroll">
      <table className="w-max min-w-[900px] border-separate border-spacing-1 text-left">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-28 bg-background text-xs font-medium text-muted-foreground">Staff</th>
            {dates.map((d) => (
              <th key={d} className="text-xs font-medium text-muted-foreground">{dayLabel(d)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {week.staff.map((p) => (
            <tr key={p.id} data-testid="staff-row" data-staff-id={p.id}>
              <th className="sticky left-0 z-10 bg-background align-top text-sm font-medium">
                <div>{p.name}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  {p.roles.join(", ")} · {p.shiftCount}/{p.maxShifts}
                </div>
              </th>
              {dates.map((d) => {
                const key = `${p.id}|${d}`;
                return (
                  <td
                    key={d}
                    data-testid="board-cell"
                    data-staff-id={p.id}
                    data-date={d}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setOverCell(key);
                    }}
                    onDragLeave={() => setOverCell((c) => (c === key ? null : c))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOverCell(null);
                      const slotId = e.dataTransfer.getData("text/plain");
                      if (slotId) onDropTo(slotId, p.id);
                    }}
                    className={cn("h-14 min-w-28 rounded-md border border-dashed p-1 align-top", overCell === key && "bg-accent")}
                  >
                    <div className="flex flex-col gap-1">{cell(p.id, d).map(chip)}</div>
                  </td>
                );
              })}
            </tr>
          ))}
          {open.length ? (
            <tr data-testid="open-row">
              <th className="sticky left-0 z-10 bg-background align-top text-sm font-medium text-destructive">Open shifts</th>
              {dates.map((d) => (
                <td key={d} className="rounded-md border border-dashed p-1 align-top">
                  <div className="flex flex-col gap-1">{cell(null, d).map(chip)}</div>
                </td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** Phone-friendly view: one day at a time, every shift with its person. */
export function DayList({
  week,
  selectedId,
  changedIds,
  pendingSlot,
  onSelect,
}: {
  week: WeekView;
  selectedId: string | null;
  changedIds: Set<string>;
  pendingSlot: string | null;
  onSelect: (id: string | null) => void;
}) {
  const dates = Array.from(new Set(week.slots.map((s) => s.date))).sort();
  const [day, setDay] = useState<string>(dates[0] ?? "");
  const current = dates.includes(day) ? day : (dates[0] ?? "");
  const slots = week.slots.filter((s) => s.date === current);
  return (
    <div className="space-y-2" data-testid="day-list">
      <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Day">
        {dates.map((d) => (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={d === current}
            onClick={() => setDay(d)}
            className={cn("shrink-0 rounded-full border px-3 py-1 text-sm", d === current ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            {dayLabel(d)}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {slots.map((s) => (
          <SlotChip
            key={s.id}
            slot={s}
            showPerson
            selected={s.id === selectedId}
            changed={changedIds.has(s.id)}
            pending={pendingSlot === s.id}
            onSelect={() => onSelect(s.id === selectedId ? null : s.id)}
          />
        ))}
      </div>
    </div>
  );
}
