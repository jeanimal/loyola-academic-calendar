import { nextEvent, relativeDays, termStatus } from "../lib/calendar.ts";
import { formatRange, formatShort } from "../lib/dates.ts";
import type { AcademicEvent, CalendarData, DateString } from "../lib/types.ts";

type Props = {
  data: CalendarData;
  today: DateString;
  onSelect: (event: AcademicEvent) => void;
};

export function AtAGlance({ data, today, onSelect }: Props) {
  const dayOff = nextEvent(data.events, today, (e) => e.category === "no-classes");
  const deadline = nextEvent(data.events, today, (e) => e.category === "deadline");
  const status = termStatus(data.terms, today);

  return (
    <section className="glance" aria-label="At a glance">
      <EventCard label="Next day off" event={dayOff} today={today} onSelect={onSelect} />
      <EventCard label="Next deadline" event={deadline} today={today} onSelect={onSelect} />

      <div className="glance-card">
        {status.kind === "in-term" ? (
          <>
            <p className="glance-label">{status.term.name}</p>
            <p className="glance-title">
              Week {Math.min(status.week, status.totalWeeks)} of {status.totalWeeks}
            </p>
            <div
              className="progress"
              role="progressbar"
              aria-label={`${status.term.name} progress`}
              aria-valuenow={Math.round(status.progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div style={{ width: `${status.progress * 100}%` }} />
            </div>
            <p className="glance-meta">
              {status.term.classesEnd ? (
                <>
                  Classes end {formatShort(status.term.classesEnd)}
                  <span className="glance-secondary"> · Term ends {formatShort(status.term.end)}</span>
                </>
              ) : (
                <>Term ends {formatShort(status.term.end)}</>
              )}
            </p>
          </>
        ) : status.kind === "between-terms" ? (
          <>
            <p className="glance-label">Next semester</p>
            <p className="glance-title">{status.next.name}</p>
            <p className="glance-meta">
              <span className="glance-secondary">Classes begin {formatShort(status.next.start)} · </span>
              <strong>in {status.daysUntil} days</strong>
            </p>
          </>
        ) : (
          <>
            <p className="glance-label">Semester</p>
            <p className="glance-title">No upcoming semester published</p>
          </>
        )}
      </div>
    </section>
  );
}

function EventCard({
  label,
  event,
  today,
  onSelect,
}: {
  label: string;
  event: AcademicEvent | undefined;
  today: DateString;
  onSelect: (event: AcademicEvent) => void;
}) {
  if (!event) {
    return (
      <div className="glance-card">
        <p className="glance-label">{label}</p>
        <p className="glance-title">None published</p>
      </div>
    );
  }
  return (
    <button type="button" className={`glance-card is-button accent-${event.category}`} onClick={() => onSelect(event)}>
      <span className="glance-label">{label}</span>
      <span className="glance-title">{event.title}</span>
      <span className="glance-meta">
        <span className="glance-secondary">{formatRange(event.start, event.end, true)} · </span>
        <strong>{relativeDays(event, today)}</strong>
      </span>
    </button>
  );
}
