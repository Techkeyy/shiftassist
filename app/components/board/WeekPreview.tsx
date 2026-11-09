import type { WeekView } from "../../../server/lib/week-view";
import { bandOf, dayParts, plainTime } from "./format";

/** A small read-only picture of the week: one row per person, L for lunch, D for dinner. Real data only. */
export function WeekPreview({ week, label = "Preview of your week" }: { week: WeekView; label?: string }) {
  const dates = Array.from(new Set(week.slots.map((s) => s.date))).sort();
  const open = week.slots.filter((s) => !s.staffId);
  return (
    <div className="preview" data-testid="week-preview">
      <div className="preview-scroll">
        <table className="preview-table" aria-label={label}>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Person</span></th>
              {dates.map((d) => (
                <th key={d} scope="col">{dayParts(d).name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {week.staff.map((p) => (
              <tr key={p.id}>
                <th scope="row">{p.name}</th>
                {dates.map((d) => (
                  <td key={d}>
                    {week.slots
                      .filter((s) => s.staffId === p.id && s.date === d)
                      .map((s) => (
                        <span key={s.id} className="mini" data-band={bandOf(s.start)} title={`${bandOf(s.start) === "lunch" ? "Lunch" : "Dinner"} ${plainTime(s.start, s.end)}`}>
                          {bandOf(s.start) === "lunch" ? "L" : "D"}
                        </span>
                      ))}
                  </td>
                ))}
              </tr>
            ))}
            {open.length ? (
              <tr className="preview-open">
                <th scope="row">Open</th>
                {dates.map((d) => (
                  <td key={d}>
                    {open.filter((s) => s.date === d).map((s) => (
                      <span key={s.id} className="mini" data-open="true" data-band={bandOf(s.start)}>{bandOf(s.start) === "lunch" ? "L" : "D"}</span>
                    ))}
                  </td>
                ))}
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="hint">L is a lunch shift, D is a dinner shift. {open.length ? "Dashed boxes have nobody yet." : ""}</p>
    </div>
  );
}
