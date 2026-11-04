import { useActionQuery } from "@agent-native/core/client/hooks";
import { useLayoutEffect, useRef, useState } from "react";

import type { WeekView } from "../../../server/lib/week-view";
import { cn } from "@/lib/utils";
import { DayArc, Hatch, HatchDefs } from "./art";
import { dayLabel, dayParts } from "./format";

type SlotView = WeekView["slots"][number];

export function SlotChip({
  slot,
  selected,
  changed,
  pending,
  showPerson,
  onSelect,
  onArm,
  onDragState,
  register,
}: {
  slot: SlotView;
  selected: boolean;
  changed: boolean;
  pending: boolean;
  showPerson?: boolean;
  onSelect: () => void;
  onArm?: () => void;
  onDragState?: (dragging: boolean) => void;
  register?: (el: HTMLElement | null) => void;
}) {
  const label = `${slot.description}${slot.staffName ? `, ${slot.staffName}` : ", open"}${slot.locked ? ", locked" : ""}${changed ? ", changed" : ""}`;
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      ref={register}
      data-testid="shift-chip"
      data-slot-id={slot.id}
      data-changed={changed ? "true" : undefined}
      data-locked={slot.locked ? "true" : undefined}
      data-open={slot.staffId ? undefined : "true"}
      data-pending={pending ? "true" : undefined}
      aria-pressed={selected}
      aria-label={label}
      onPointerDown={onArm}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", slot.id);
        e.dataTransfer.effectAllowed = "move";
        onDragState?.(true);
      }}
      onDragEnd={() => onDragState?.(false)}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className="slip"
    >
      {changed ? <span className="docket-flag" aria-hidden="true" /> : null}
      <div className="slip-top">
        <span>
          {slot.label}
          {showPerson ? <span className="font-normal"> {slot.staffName ?? "Open"}</span> : null}
        </span>
      </div>
      <div className="slip-time">
        {slot.start}-{slot.end}
      </div>
      <div className="slip-sub">
        <DayArc start={slot.start} end={slot.end} className="slip-arc" />
        {slot.locked || changed || !slot.staffId ? <span>{slot.locked ? "Locked" : changed ? "Changed" : "Open"}</span> : null}
      </div>
    </div>
  );
}

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  const [dragId, setDragId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);
  const [hoverStaff, setHoverStaff] = useState<string | null>(null);
  const dates = Array.from(new Set(week.slots.map((s) => s.date))).sort();
  const cell = (staffId: string | null, date: string) => week.slots.filter((s) => s.staffId === staffId && s.date === date);
  const open = week.slots.filter((s) => !s.staffId);

  // Live rules: the engine's verdict per person for the picked-up shift, cached per slot by the query key.
  // Nothing is shown until it has actually loaded.
  const activeId = dragId ?? selectedId ?? armedId;
  const elig = useActionQuery("slot-eligibility", { slotId: activeId ?? "" }, { enabled: Boolean(activeId), staleTime: 15_000 });
  const activeSlot = activeId ? week.slots.find((s) => s.id === activeId) : undefined;
  const verdicts = new Map<string, { allowed: boolean; blockedBy: string[]; wouldBreakSoft: string[] }>();
  if (activeSlot && elig.data && elig.data.slotId === activeSlot.id) {
    for (const p of elig.data.people) verdicts.set(p.staffId, p);
  }

  // FLIP: when a slip lands in a different place, it travels from the old cell to the new one.
  const els = useRef(new Map<string, HTMLElement>());
  const prev = useRef(new Map<string, { x: number; y: number }>());
  const tableRef = useRef<HTMLTableElement | null>(null);
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const t = table.getBoundingClientRect();
    const next = new Map<string, { x: number; y: number }>();
    els.current.forEach((el, id) => {
      if (!el.isConnected) return;
      const r = el.getBoundingClientRect();
      const pos = { x: r.left - t.left, y: r.top - t.top };
      next.set(id, pos);
      const before = prev.current.get(id);
      if (before && !reduceMotion() && (Math.abs(before.x - pos.x) > 3 || Math.abs(before.y - pos.y) > 3)) {
        el.animate(
          [{ transform: `translate(${before.x - pos.x}px, ${before.y - pos.y}px)` }, { transform: "translate(0, 0)" }],
          { duration: 250, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
        );
      }
    });
    prev.current = next;
  });

  const chip = (s: SlotView) => (
    <SlotChip
      key={s.id}
      slot={s}
      register={(el) => {
        if (el) els.current.set(s.id, el);
        else els.current.delete(s.id);
      }}
      selected={s.id === selectedId}
      changed={changedIds.has(s.id)}
      pending={pendingSlot === s.id}
      onArm={() => setArmedId(s.id)}
      onDragState={(d) => setDragId(d ? s.id : null)}
      onSelect={() => {
        setArmedId(null);
        onSelect(s.id === selectedId ? null : s.id);
      }}
    />
  );

  return (
    <div className="sheet" data-testid="board-scroll" onMouseLeave={() => setHoverStaff(null)}>
      <HatchDefs />
      <table className="rota" ref={tableRef} aria-label="Week sheet">
        <thead>
          <tr>
            <th scope="col">
              <span className="day-name">Staff</span>
              <span className="day-date">shifts / limit</span>
            </th>
            {dates.map((d) => {
              const p = dayParts(d);
              return (
                <th key={d} scope="col" aria-label={dayLabel(d)}>
                  <span className="day-name">{p.name}</span>
                  <span className="day-date">{p.date}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {week.staff.map((p) => (
            <tr
              key={p.id}
              data-testid="staff-row"
              data-staff-id={p.id}
              data-dim={!activeId && hoverStaff !== null && hoverStaff !== p.id ? "true" : undefined}
              onMouseEnter={() => setHoverStaff(p.id)}
              onFocus={() => setHoverStaff(p.id)}
            >
              <th scope="row">
                <span className="who">{p.name}</span>
                <span className="meta">
                  {p.roles.join(", ")} <span className="mono">{p.shiftCount}/{p.maxShifts}</span>
                </span>
              </th>
              {dates.map((d) => {
                const key = `${p.id}|${d}`;
                const v = activeSlot && activeSlot.date === d && p.id !== activeSlot.staffId ? verdicts.get(p.id) : undefined;
                const state = v ? (v.allowed ? "allowed" : "blocked") : undefined;
                const reason = v && !v.allowed ? v.blockedBy.join(" ") || "Not available." : undefined;
                return (
                  <td
                    key={d}
                    data-testid="board-cell"
                    data-staff-id={p.id}
                    data-date={d}
                    data-over={overCell === key ? "true" : undefined}
                    data-eligible={state}
                    tabIndex={state === "blocked" ? 0 : undefined}
                    aria-label={
                      state === "blocked"
                        ? `${p.name} on ${dayLabel(d)} cannot take this shift: ${reason}`
                        : state === "allowed"
                          ? `${p.name} on ${dayLabel(d)} can take this shift${v!.wouldBreakSoft.length ? `, but it goes against a preference: ${v!.wouldBreakSoft.join(" ")}` : ""}`
                          : undefined
                    }
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setOverCell(key);
                    }}
                    onDragLeave={() => setOverCell((c) => (c === key ? null : c))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOverCell(null);
                      setDragId(null);
                      const slotId = e.dataTransfer.getData("text/plain");
                      if (slotId) onDropTo(slotId, p.id);
                    }}
                  >
                    {state === "blocked" ? (
                      <>
                        <Hatch />
                        <span className="why-blocked" role="note">
                          {reason}
                        </span>
                      </>
                    ) : null}
                    {state === "allowed" ? (
                      <span className="ok-mark">
                        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        {v!.wouldBreakSoft.length ? "Preference" : "Can take it"}
                      </span>
                    ) : null}
                    {cell(p.id, d).map(chip)}
                  </td>
                );
              })}
            </tr>
          ))}
          {open.length ? (
            <tr data-testid="open-row" className="open-row">
              <th scope="row">
                <span className="who">Open shifts</span>
                <span className="meta">Nobody on them yet</span>
              </th>
              {dates.map((d) => (
                <td key={d}>{cell(null, d).map(chip)}</td>
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
    <div data-testid="day-list" className="sheet" style={{ overflow: "visible" }}>
      <div className="flex overflow-x-auto border-b" role="tablist" aria-label="Day" style={{ borderColor: "hsl(var(--rule-strong))" }}>
        {dates.map((d) => {
          const p = dayParts(d);
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === current}
              onClick={() => setDay(d)}
              className={cn(
                "min-h-12 min-w-16 shrink-0 border-r px-3 py-1 text-left",
                d === current ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
              style={{ borderColor: "hsl(var(--rule))" }}
            >
              <span className="display block text-base leading-tight">{p.name}</span>
              <span className="mono block text-sm leading-tight">{p.date}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-col py-1">
        {slots.length === 0 ? <p className="hint p-3">No shifts this day.</p> : null}
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
