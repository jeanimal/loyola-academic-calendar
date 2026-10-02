/**
 * Sanity checks on the final data, independent of how it was parsed.
 * Returns a list of problems; an empty list means the data looks publishable.
 */
import { daysBetween, isDateString, parts } from "../lib/dates.ts";
import type { CalendarData, TermSeason } from "../lib/types.ts";

/** Loyola publishes several years at once; far fewer events means trouble. */
export const MIN_EVENTS = 100;
export const MIN_EVENTS_PER_SEMESTER = 15;
const MAX_EVENT_DAYS = 14;

/** Months each season's events may fall in (catches wrong-year parsing). */
const SEASON_MONTHS: Record<TermSeason, number[]> = {
  Fall: [8, 9, 10, 11, 12],
  Spring: [1, 2, 3, 4, 5],
  Summer: [5, 6, 7, 8],
  "J-Term": [12, 1],
};

/** Plausible lengths (first day of classes → last day of term). */
const TERM_DAYS: Record<"Fall" | "Spring" | "Summer", [number, number]> = {
  Fall: [95, 130],
  Spring: [95, 130],
  Summer: [50, 100],
};

export function validate(data: CalendarData): string[] {
  const problems: string[] = [];
  const { events, terms } = data;

  if (events.length < MIN_EVENTS) {
    problems.push(`only ${events.length} events found; expected at least ${MIN_EVENTS}`);
  }

  const seen = new Set<string>();
  for (const e of events) {
    const label = `event ${e.id}`;
    if (seen.has(e.id)) problems.push(`duplicate event id ${e.id}`);
    seen.add(e.id);

    if (!/^[a-z0-9-]+$/.test(e.id)) problems.push(`${label}: malformed id`);
    if (!e.title.trim()) problems.push(`${label}: empty title`);
    if (!e.description.trim()) problems.push(`${label}: empty description`);
    if (!isDateString(e.start) || !isDateString(e.end)) {
      problems.push(`${label}: invalid date ${e.start}..${e.end}`);
      continue;
    }
    if (e.end < e.start) problems.push(`${label}: ends before it starts`);
    if (daysBetween(e.start, e.end) + 1 > MAX_EVENT_DAYS) {
      problems.push(`${label}: suspiciously long (${e.start} to ${e.end})`);
    }

    const match = /^(Fall|Spring|Summer|J-Term) (\d{4})$/.exec(e.term);
    if (!match) {
      problems.push(`${label}: malformed term "${e.term}"`);
      continue;
    }
    const season = match[1] as TermSeason;
    const year = Number(match[2]);
    for (const d of [e.start, e.end]) {
      const { year: y, month } = parts(d);
      // Only J-Term may begin in the previous calendar year (December).
      const expectedYear = season === "J-Term" && month === 12 ? year - 1 : year;
      if (!SEASON_MONTHS[season].includes(month) || y !== expectedYear) {
        problems.push(`${label}: date ${d} is outside the expected range for ${e.term}`);
      }
    }
  }

  // Every Fall/Spring/Summer that has events must have a usable term.
  const termNames = new Set(
    events.map((e) => e.term).filter((t) => !t.startsWith("J-Term")),
  );
  for (const name of termNames) {
    const term = terms.find((t) => t.name === name);
    if (!term) {
      problems.push(`${name}: missing term start or end (e.g. "semester begins" / "final exams")`);
      continue;
    }
    const length = daysBetween(term.start, term.end);
    const [min, max] = TERM_DAYS[term.season as keyof typeof TERM_DAYS];
    if (length < min || length > max) {
      problems.push(`${name}: implausible length of ${length} days (${term.start} to ${term.end})`);
    }
    if (term.season === "Fall" || term.season === "Spring") {
      if (!term.classesEnd) problems.push(`${name}: missing last day of classes`);
      else if (term.classesEnd < term.start || term.classesEnd > term.end) {
        problems.push(`${name}: last day of classes ${term.classesEnd} is outside the term`);
      }
      const count = events.filter((e) => e.term === name).length;
      if (count < MIN_EVENTS_PER_SEMESTER) {
        problems.push(`${name}: only ${count} events; expected at least ${MIN_EVENTS_PER_SEMESTER}`);
      }
    }
  }

  for (const season of ["Fall", "Spring", "Summer"] as const) {
    if (!terms.some((t) => t.season === season)) problems.push(`no ${season} terms found`);
  }

  return problems;
}
