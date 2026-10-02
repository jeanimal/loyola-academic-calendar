/** Pure helpers behind the calendar UI. No React here, so they're easy to test. */
import { addDays, addMonths, daysBetween, parts, startOfMonth, weekday } from "./dates.ts";
import type { AcademicEvent, DateString, Term } from "./types.ts";

export function overlaps(event: AcademicEvent, from: DateString, to: DateString): boolean {
  return event.start <= to && event.end >= from;
}

/** Sunday-start weeks covering the month that begins on `monthStart`. */
export function monthWeeks(monthStart: DateString): DateString[][] {
  const first = addDays(monthStart, -weekday(monthStart));
  const lastOfMonth = addDays(addMonths(monthStart, 1), -1);
  const weeks: DateString[][] = [];
  for (let weekStart = first; weekStart <= lastOfMonth; weekStart = addDays(weekStart, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
  }
  return weeks;
}

export type WeekSegment = {
  event: AcademicEvent;
  /** 0 = Sunday column */
  column: number;
  span: number;
  lane: number;
  /** The event started in an earlier week / continues into a later one. */
  continuesBefore: boolean;
  continuesAfter: boolean;
};

/**
 * Lay out the events of one week as horizontal bars, Google-Calendar style:
 * multi-day events first (so long bars stay on top), each in the lowest
 * free lane.
 */
export function layoutWeek(weekStart: DateString, events: AcademicEvent[]): WeekSegment[] {
  const weekEnd = addDays(weekStart, 6);
  const inWeek = events
    .filter((e) => overlaps(e, weekStart, weekEnd))
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        daysBetween(b.start, b.end) - daysBetween(a.start, a.end) ||
        a.id.localeCompare(b.id),
    );

  const lanes: number[][] = []; // lanes[lane] = occupied columns
  return inWeek.map((event) => {
    const from = event.start < weekStart ? weekStart : event.start;
    const to = event.end > weekEnd ? weekEnd : event.end;
    const column = daysBetween(weekStart, from);
    const span = daysBetween(from, to) + 1;
    const columns = Array.from({ length: span }, (_, i) => column + i);

    let lane = lanes.findIndex((used) => columns.every((c) => !used.includes(c)));
    if (lane === -1) lane = lanes.push([]) - 1;
    lanes[lane]!.push(...columns);

    return {
      event,
      column,
      span,
      lane,
      continuesBefore: event.start < weekStart,
      continuesAfter: event.end > weekEnd,
    };
  });
}

/** Earliest and latest months that contain events. */
export function monthRange(events: AcademicEvent[]): { first: DateString; last: DateString } {
  const starts = events.map((e) => e.start).sort();
  const ends = events.map((e) => e.end).sort();
  return { first: startOfMonth(starts[0]!), last: startOfMonth(ends.at(-1)!) };
}

export function clampMonth(month: DateString, range: { first: DateString; last: DateString }): DateString {
  if (month < range.first) return range.first;
  if (month > range.last) return range.last;
  return month;
}

/** The next event (or one in progress) matching `predicate`, by start date. */
export function nextEvent(
  events: AcademicEvent[],
  today: DateString,
  predicate: (e: AcademicEvent) => boolean,
): AcademicEvent | undefined {
  return events
    .filter((e) => predicate(e) && e.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
}

export type TermStatus =
  | { kind: "in-term"; term: Term; week: number; totalWeeks: number; progress: number }
  | { kind: "between-terms"; next: Term; daysUntil: number }
  | { kind: "none" };

/**
 * Where `today` falls relative to the main semesters. Summer is skipped:
 * its overlapping sessions don't have a single meaningful "week N of M".
 */
export function termStatus(terms: Term[], today: DateString): TermStatus {
  const semesters = terms.filter((t) => t.season === "Fall" || t.season === "Spring");
  const current = semesters.find((t) => t.start <= today && today <= t.end);
  if (current) {
    const totalDays = daysBetween(current.start, current.end) + 1;
    const elapsed = daysBetween(current.start, today) + 1;
    return {
      kind: "in-term",
      term: current,
      week: Math.floor((elapsed - 1) / 7) + 1,
      totalWeeks: Math.ceil(totalDays / 7),
      progress: elapsed / totalDays,
    };
  }
  const next = semesters.filter((t) => t.start > today).sort((a, b) => a.start.localeCompare(b.start))[0];
  return next ? { kind: "between-terms", next, daysUntil: daysBetween(today, next.start) } : { kind: "none" };
}

/** "today", "tomorrow", "in 12 days", "now" */
export function relativeDays(event: AcademicEvent, today: DateString): string {
  if (event.start <= today && today <= event.end) return event.start === event.end ? "today" : "happening now";
  const days = daysBetween(today, event.start);
  if (days === 1) return "tomorrow";
  if (days < 7 * 8) return `in ${days} days`;
  return `in ${Math.round(days / 7)} weeks`;
}

/** Parse "#2026-11" style hashes into a month start. */
export function monthFromHash(hash: string): DateString | undefined {
  const m = /^#?(\d{4})-(\d{2})$/.exec(hash);
  if (!m) return undefined;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return undefined;
  return `${m[1]}-${m[2]}-01`;
}

export function monthToHash(monthStart: DateString): string {
  const { year, month } = parts(monthStart);
  return `#${year}-${String(month).padStart(2, "0")}`;
}
