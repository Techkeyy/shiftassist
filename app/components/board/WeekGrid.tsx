import { useActionQuery } from "@agent-native/core/client/hooks";
import { useLayoutEffect, useRef, useState } from "react";

import type { WeekView } from "../../../server/lib/week-view";
import { cn } from "@/lib/utils";
import { Hatch, HatchDefs, Pin, Tally } from "./art";
import { bandOf, dayLabel, dayParts, plainTime, timeWords } from "./format";

type SlotView = WeekView["slots"][number];
type Fairness = NonNullable<WeekView["fairness"]>;

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
  const band = bandOf(slot.start);
  const bandWord = band === "lunch" ? "Lunch" : "Dinner";
  const label = `${slot.description}, ${timeWords(slot.start, slot.end)}${slot.staffName ? `, ${slot.staffName}` : ", open"}${slot.locked ? ", locked" : ""}${changed ? ", changed" : ""}`;
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!showPerson}
      ref={register}
      data-testid="shift-chip"
      data-slot-id={slot.id}
      data-band={band}
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
      title={`${slot.label}, ${timeWords(slot.start, slot.end)}`}
    >
      {changed ? <span className="docket-flag" aria-hidden="true" /> : null}
      <span className="slip-top">
        <span className="slip-name">
          {slot.locked ? <Pin className="slip-pin" /> : null}
          {showPerson ? <span className="slip-person">{slot.staffName ?? "Open"}: </span> : null}
          {bandWord} {plainTime(slot.start, slot.end)}
        </span>
      </span>
      {changed ? <span className="slip-sub">Changed</span> : !slot.staffId && !showPerson ? <span className="slip-sub">Needs a {slot.role}</span> : null}
    </div>
  );
}

/** One person's tally line: label, marks on a baseline, the count, and a word when above the team average. */
export function FairnessLine({
  label,
  who,
  count,
  average,
  max,
}: {
  label: string;
  who: string;
  count: number;
  average: number;
  max: number;
}) {
  return (
    <div className="tally-line">
      <span className="tally-label">{label}</span>
      <Tally count={count} average={average} max={max} label={`${who}, ${label.toLowerCase()}`} />
      <span className="tally-count">{count}</span>
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
  showFairness,
}: {
  week: WeekView;
  selectedId: string | null;
  changedIds: Set<string>;
  pendingSlot: string | null;
  onSelect: (id: string | null) => void;
  onDropTo: (slotId: string, staffId: string) => void;
  showFairness?: boolean;
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

  const fair = new Map((week.fairness?.people ?? []).map((f) => [f.staffId, f]));
  const avg = week.fairness?.averages;
  const maxCloses = Math.max(0, ...(week.fairness?.people ?? []).map((f) => f.closes));
  const maxWeekends = Math.max(0, ...(week.fairness?.people ?? []).map((f) => f.weekends));

  const bands = (items: SlotView[]) => (
    <div className="bands">
      <div className="band" data-band="lunch">
        {items.filter((x) => bandOf(x.start) === "lunch").map(chip)}
      </div>
      <div className="band" data-band="dinner">
        {items.filter((x) => bandOf(x.start) === "dinner").map(chip)}
      </div>
    </div>
  );

  return (
    <div className="sheet" data-testid="board-scroll" onMouseLeave={() => setHoverStaff(null)}>
      <HatchDefs />
      <table className="rota" ref={tableRef} aria-label="Your week">
        <thead>
          <tr>
            <th scope="col" className="staff-col">
              <span className="day-name">Person</span>
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
          {week.staff.map((p) => {
            const f = fair.get(p.id);
            return (
              <tr
                key={p.id}
                data-testid="staff-row"
                data-staff-id={p.id}
                data-dim={!activeId && hoverStaff !== null && hoverStaff !== p.id ? "true" : undefined}
                onMouseEnter={() => setHoverStaff(p.id)}
                onFocus={() => setHoverStaff(p.id)}
              >
                <th scope="row" className="staff-col">
                  <span className="who">
                    {p.name}
                    <span className="roles" title={p.roles.join(", ")}>{p.roles.join(", ")}</span>
                    <span className="limit" title={`${p.shiftCount} shifts this week. ${p.name} can work up to ${p.maxShifts}.`}>{p.shiftCount} {p.shiftCount === 1 ? "shift" : "shifts"}</span>
                  </span>
                  {showFairness && f && avg ? (
                    <span data-testid="fairness-person" className="tallies">
                      <FairnessLine label="Closes" who={p.name} count={f.closes} average={avg.closes} max={maxCloses} />
                      <FairnessLine label="Weekends" who={p.name} count={f.weekends} average={avg.weekends} max={maxWeekends} />
                    </span>
                  ) : null}
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
                      {bands(cell(p.id, d))}
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
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {open.length ? (
            <tr data-testid="open-row" className="open-row">
              <th scope="row" className="staff-col">
                <span className="who">Open shifts</span>
                <span className="meta">Nobody on them yet</span>
              </th>
              {dates.map((d) => (
                <td key={d}>{bands(cell(null, d))}</td>
              ))}
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

/** Tally per person, for the phone drawer. Same engine numbers as the sheet. */
export function TallyList({ week }: { week: WeekView }) {
  const f: Fairness | null = week.fairness;
  if (!f) return <p className="hint">Nothing to count until your week is built.</p>;
  const maxCloses = Math.max(0, ...f.people.map((p) => p.closes));
  const maxWeekends = Math.max(0, ...f.people.map((p) => p.weekends));
  return (
    <ul className="space-y-3">
      {f.people.map((p) => (
        <li key={p.staffId} data-testid="fairness-person" className="tally-card">
          <span className="who">
            {p.name} <span className="limit">{p.shifts} shifts</span>
          </span>
          <FairnessLine label="Closes" who={p.name} count={p.closes} average={f.averages.closes} max={maxCloses} />
          <FairnessLine label="Weekends" who={p.name} count={p.weekends} average={f.averages.weekends} max={maxWeekends} />
        </li>
      ))}
    </ul>
  );
}

/** Phone view: one day at a time, or one person's whole week, shifts grouped by Lunch and Dinner. */
export function DayList({
  week,
  selectedId,
  changedIds,
  pendingSlot,
  onSelect,
  onTally,
}: {
  week: WeekView;
  selectedId: string | null;
  changedIds: Set<string>;
  pendingSlot: string | null;
  onSelect: (id: string | null) => void;
  onTally?: () => void;
}) {
  const dates = Array.from(new Set(week.slots.map((s) => s.date))).sort();
  const [day, setDay] = useState<string>(dates[0] ?? "");
  const [who, setWho] = useState<string>("all");
  const current = dates.includes(day) ? day : (dates[0] ?? "");
  const matches = (s: SlotView) => (who === "all" ? true : who === "open" ? !s.staffId : s.staffId === who);
  const chipFor = (s: SlotView) => (
    <SlotChip
      key={s.id}
      slot={s}
      showPerson
      selected={s.id === selectedId}
      changed={changedIds.has(s.id)}
      pending={pendingSlot === s.id}
      onSelect={() => onSelect(s.id === selectedId ? null : s.id)}
    />
  );
  const group = (slots: SlotView[]) =>
    (["lunch", "dinner"] as const).map((b) => {
      const items = slots.filter((s) => bandOf(s.start) === b);
      if (!items.length) return null;
      return (
        <div key={b} className="day-band" data-band={b}>
          <h3 className="band-title">{b === "lunch" ? "Lunch" : "Dinner"}</h3>
          {items.map(chipFor)}
        </div>
      );
    });
  const oneDay = week.slots.filter((s) => s.date === current && matches(s));
  const person = who === "all" || who === "open" ? null : week.staff.find((p) => p.id === who);
  return (
    <div data-testid="day-list" className="sheet day-sheet">
      <div className="day-controls">
        <label className="day-filter">
          <span>Show one person</span>
          <select className="field" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Show one person">
            <option value="all">Everyone</option>
            {week.staff.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {week.slots.some((s) => !s.staffId) ? <option value="open">Open shifts</option> : null}
          </select>
        </label>
        {onTally && week.fairness ? (
          <button type="button" className="btn btn-secondary" onClick={onTally}>Show fairness</button>
        ) : null}
      </div>
      {person ? (
        <div className="flex flex-col pb-1">
          {dates.map((d) => {
            const mine = week.slots.filter((s) => s.date === d && s.staffId === person.id);
            if (!mine.length) return null;
            return (
              <section key={d} className="person-day" aria-label={dayLabel(d)}>
                <h3 className="band-title">{dayLabel(d)}</h3>
                {mine.map(chipFor)}
              </section>
            );
          })}
          {!week.slots.some((s) => s.staffId === person.id) ? <p className="hint p-3">{person.name} has no shifts this week.</p> : null}
        </div>
      ) : (
        <>
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
                  className={cn("min-h-12 min-w-16 shrink-0 border-r px-3 py-1 text-left", d === current ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                  style={{ borderColor: "hsl(var(--rule))" }}
                >
                  <span className="display block text-base leading-tight">{p.name}</span>
                  <span className="block text-sm leading-tight">{p.date}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col pb-1">
            {oneDay.length === 0 ? <p className="hint p-3">No shifts this day.</p> : null}
            {group(oneDay)}
          </div>
        </>
      )}
    </div>
  );
}
