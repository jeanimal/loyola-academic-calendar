import { useMemo, type CSSProperties } from "react";
import { layoutWeek, monthWeeks } from "../lib/calendar.ts";
import { categoryLabel } from "../lib/categories.ts";
import { formatLong, formatRange, parts, weekday } from "../lib/dates.ts";
import type { AcademicEvent, DateString } from "../lib/types.ts";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Props = {
  month: DateString;
  events: AcademicEvent[];
  today: DateString;
  onSelect: (event: AcademicEvent) => void;
};

export function MonthGrid({ month, events, today, onSelect }: Props) {
  const { month: monthNumber } = parts(month);
  const weeks = useMemo(() => monthWeeks(month), [month]);
  const daysOff = useMemo(() => {
    const off = new Set<DateString>();
    for (const e of events) {
      if (e.category !== "no-classes") continue;
      for (const week of weeks) for (const d of week) if (d >= e.start && d <= e.end) off.add(d);
    }
    return off;
  }, [events, weeks]);

  return (
    <div className="month-grid">
      <div className="weekday-row" aria-hidden="true">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      {weeks.map((week) => {
        const segments = layoutWeek(week[0]!, events);
        const lanes = Math.max(0, ...segments.map((s) => s.lane + 1));
        return (
          <div
            key={week[0]}
            className="week"
            style={{ "--lanes": lanes } as CSSProperties}
          >
            {week.map((day, i) => {
              const classes = ["day"];
              if (parts(day).month !== monthNumber) classes.push("is-outside");
              if (weekday(day) === 0 || weekday(day) === 6) classes.push("is-weekend");
              if (daysOff.has(day)) classes.push("is-off");
              if (day === today) classes.push("is-today");
              return (
                <div key={day} className={classes.join(" ")} style={{ gridColumn: i + 1 }}>
                  <span className="day-number">
                    <span className="sr-only">{formatLong(day)}</span>
                    <span aria-hidden="true">{parts(day).day}</span>
                    {day === today && <span className="sr-only"> (today)</span>}
                  </span>
                </div>
              );
            })}
            {segments.map((s) => (
              <button
                key={s.event.id}
                type="button"
                className={[
                  "bar",
                  `cat-${s.event.category}`,
                  s.continuesBefore ? "continues-before" : "",
                  s.continuesAfter ? "continues-after" : "",
                ].join(" ")}
                style={{ gridColumn: `${s.column + 1} / span ${s.span}`, gridRow: s.lane + 2 }}
                onClick={() => onSelect(s.event)}
                aria-label={`${s.event.title}, ${formatRange(s.event.start, s.event.end, true)}, ${categoryLabel(s.event.category)}`}
                title={s.event.title}
              >
                {s.event.warning && <span aria-hidden="true">⚠ </span>}
                {s.event.title}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
