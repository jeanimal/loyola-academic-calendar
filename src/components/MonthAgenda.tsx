import { relativeDays } from "../lib/calendar.ts";
import { categoryLabel } from "../lib/categories.ts";
import { formatMonthYear, formatRange, weekdayName } from "../lib/dates.ts";
import type { AcademicEvent, DateString } from "../lib/types.ts";

type Props = {
  month: DateString;
  events: AcademicEvent[];
  today: DateString;
  onSelect: (event: AcademicEvent) => void;
};

/** The month's events as a readable list: the main view on phones. */
export function MonthAgenda({ month, events, today, onSelect }: Props) {
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
  return (
    <div className="agenda">
      <h3 className="agenda-title">Dates in {formatMonthYear(month)}</h3>
      {sorted.length === 0 ? (
        <p className="empty">No dates this month with the current filters.</p>
      ) : (
        <ul>
          {sorted.map((e) => {
            const past = e.end < today;
            return (
              <li key={e.id} className={past ? "is-past" : undefined}>
                <button type="button" className="agenda-item" onClick={() => onSelect(e)}>
                  <span className="agenda-date">
                    {formatRange(e.start, e.end)}
                    <span className="agenda-weekday">
                      {weekdayName(e.start).slice(0, 3)}
                      {e.end !== e.start && ` – ${weekdayName(e.end).slice(0, 3)}`}
                    </span>
                  </span>
                  <span className={`swatch cat-${e.category}`} aria-hidden="true" />
                  <span className="agenda-text">
                    <span className="agenda-name">
                      {e.warning && <span aria-label="Warning: ">⚠ </span>}
                      {e.title}
                    </span>
                    <span className="agenda-meta">
                      {categoryLabel(e.category)}
                      {!past && <> · {relativeDays(e, today)}</>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
