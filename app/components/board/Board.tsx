import {
  actionErrorMessage,
  deleteClientAppState,
  useActionMutation,
  useActionQuery,
  useDbSync,
  writeClientAppState,
} from "@agent-native/core/client/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import type { WeekView } from "../../../server/lib/week-view";
import { TAB_ID } from "@/lib/tab-id";
import { cn } from "@/lib/utils";

type SlotView = WeekView["slots"][number];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()]} ${date.slice(5)}`;
}

function SlotChip({
  slot,
  selected,
  pending,
  onSelect,
}: {
  slot: SlotView;
  selected: boolean;
  pending: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-testid="shift-chip"
      data-slot-id={slot.id}
      aria-pressed={selected}
      aria-label={`${slot.description}${slot.staffName ? `, ${slot.staffName}` : ", open"}${slot.locked ? ", locked" : ""}`}
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
        selected && "ring-2 ring-primary",
        slot.locked && "border-primary",
        pending && "opacity-50",
      )}
    >
      <div className="font-medium">{slot.label}</div>
      <div className="text-muted-foreground">
        {slot.start}-{slot.end}
        {slot.locked ? " · locked" : ""}
      </div>
    </div>
  );
}

export function Board() {
  const queryClient = useQueryClient();
  // The week can change without this user acting (the agent over MCP/A2A, a script, another
  // tab). Only this private route opts in to remote sync; everything else stays poll-free.
  useDbSync({
    queryClient,
    ignoreSource: TAB_ID,
    realtime: { reason: "the agent, another tab or a script can change the week while the board is open" },
    pauseWhenHidden: true,
  });
  const week = useActionQuery("get-week", {});
  const load = useActionMutation("load-sample-week");
  const move = useActionMutation("move-shift");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [overRow, setOverRow] = useState<string | null>(null);

  const data = week.data;
  const selected = useMemo(
    () => data?.slots.find((s) => s.id === selectedId) ?? null,
    [data, selectedId],
  );

  // Tell the agent which shift is selected (context-awareness: tab-scoped `selection`).
  useEffect(() => {
    const key = `selection:${TAB_ID}`;
    if (selected) {
      void writeClientAppState(
        key,
        {
          kind: "shift",
          id: selected.id,
          slotId: selected.id,
          text: `${selected.description}${selected.staffName ? `, worked by ${selected.staffName}` : ", open"}${selected.locked ? " (locked)" : ""}`,
          staffId: selected.staffId,
        },
        { requestSource: TAB_ID },
      );
    } else {
      void deleteClientAppState(key, { requestSource: TAB_ID });
    }
  }, [selected]);
  useEffect(
    () => () => {
      void deleteClientAppState(`selection:${TAB_ID}`, {
        requestSource: TAB_ID,
        keepalive: true,
      });
    },
    [],
  );

  function doMove(slotId: string, staffId: string, lock?: boolean) {
    setNotice(null);
    setPendingSlot(slotId);
    move.mutate(
      { slotId, staffId, ...(lock === undefined ? {} : { lock }) },
      {
        onSuccess: (r) => setNotice({ kind: "ok", text: r.message }),
        onError: (err) =>
          setNotice({
            kind: "error",
            text: actionErrorMessage(err) ?? "Couldn't move that shift. Nothing was changed.",
          }),
        onSettled: () => setPendingSlot(null),
      },
    );
  }

  if (week.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground" role="status">Loading the week...</div>;
  }
  if (week.error) {
    return (
      <div className="p-6" role="alert">
        <p className="text-sm font-medium">The week couldn't be loaded.</p>
        <p className="text-sm text-muted-foreground">
          {actionErrorMessage(week.error) ?? "Check your connection and try again."}
        </p>
        <button
          type="button"
          className="mt-3 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          onClick={() => void week.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }
  if (!data || !data.hasWeek) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-lg font-semibold">No week yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Start with a labelled sample restaurant to see how the board works. It isn't your data.
        </p>
        <button
          type="button"
          disabled={load.isPending}
          onClick={() =>
            load.mutate(
              {},
              {
                onError: (err) =>
                  setNotice({
                    kind: "error",
                    text: actionErrorMessage(err) ?? "Couldn't load the sample.",
                  }),
              },
            )
          }
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {load.isPending ? "Loading..." : "Try the sample restaurant"}
        </button>
        {notice ? (
          <p role="alert" className="mt-3 text-sm text-destructive">{notice.text}</p>
        ) : null}
      </div>
    );
  }

  const dates = Array.from(new Set(data.slots.map((s) => s.date))).sort();
  const cell = (staffId: string | null, date: string) =>
    data.slots.filter((s) => s.staffId === staffId && s.date === date);
  const openSlots = data.slots.filter((s) => !s.staffId);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-lg font-semibold">{data.week?.name}</h1>
        {data.week?.isSample ? (
          <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">Sample data</span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          Week of {data.week?.startDate}. Drag a shift onto another person's row.
        </span>
      </div>

      {notice ? (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          data-testid="board-notice"
          className={cn(
            "flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm",
            notice.kind === "error"
              ? "border-destructive text-destructive"
              : "text-muted-foreground",
          )}
        >
          <span>{notice.text}</span>
          <button type="button" className="text-xs underline" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-1 text-left">
          <thead>
            <tr>
              <th className="w-28 text-xs font-medium text-muted-foreground">Staff</th>
              {dates.map((d) => (
                <th key={d} className="text-xs font-medium text-muted-foreground">
                  {dayLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.staff.map((p) => (
              <tr key={p.id} data-testid="staff-row" data-staff-id={p.id}>
                <th className="align-top text-sm font-medium">
                  <div>{p.name}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {p.roles.join(", ")} · {p.shiftCount}/{p.maxShifts}
                  </div>
                </th>
                {dates.map((d) => (
                  <td
                    key={d}
                    data-testid="board-cell"
                    data-staff-id={p.id}
                    data-date={d}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setOverRow(p.id);
                    }}
                    onDragLeave={() => setOverRow((r) => (r === p.id ? null : r))}
                    onDrop={(e) => {
                      e.preventDefault();
                      setOverRow(null);
                      const slotId = e.dataTransfer.getData("text/plain");
                      if (slotId) doMove(slotId, p.id);
                    }}
                    className={cn(
                      "h-14 min-w-24 align-top rounded-md border border-dashed p-1",
                      overRow === p.id && "bg-accent",
                    )}
                  >
                    <div className="flex flex-col gap-1">
                      {cell(p.id, d).map((s) => (
                        <SlotChip
                          key={s.id}
                          slot={s}
                          selected={s.id === selectedId}
                          pending={pendingSlot === s.id}
                          onSelect={() => setSelectedId(s.id === selectedId ? null : s.id)}
                        />
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            {openSlots.length ? (
              <tr data-testid="open-row">
                <th className="align-top text-sm font-medium">Open shifts</th>
                {dates.map((d) => (
                  <td key={d} className="align-top rounded-md border border-dashed p-1">
                    <div className="flex flex-col gap-1">
                      {cell(null, d).map((s) => (
                        <SlotChip
                          key={s.id}
                          slot={s}
                          selected={s.id === selectedId}
                          pending={pendingSlot === s.id}
                          onSelect={() => setSelectedId(s.id === selectedId ? null : s.id)}
                        />
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border p-3 text-sm" data-testid="selected-shift">
        {selected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span>
              <strong>{selected.description}</strong> ·{" "}
              {selected.staffName ? `worked by ${selected.staffName}` : "open"}
              {selected.locked ? " · locked" : ""}
            </span>
            {selected.staffId ? (
              <button
                type="button"
                className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                onClick={() => doMove(selected.id, selected.staffId!, !selected.locked)}
              >
                {selected.locked ? "Unlock" : "Lock to " + selected.staffName}
              </button>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground">Click a shift to select it. The assistant can see which one.</span>
        )}
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Confirmed rules ({data.rules.length})</summary>
        <ul className="mt-2 list-disc pl-5">
          {data.rules.map((r) => (
            <li key={r.id}>
              {r.text} <span className="text-xs text-muted-foreground">({r.severity})</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
