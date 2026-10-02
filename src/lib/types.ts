/**
 * Normalized academic-calendar data. This is the single source of truth
 * for both the web UI and the generated .ics feeds.
 *
 * Dates are calendar dates, never timestamps: always "YYYY-MM-DD" strings.
 * See src/lib/dates.ts for the only code allowed to do arithmetic on them.
 */

/** A calendar date in "YYYY-MM-DD" form, with no time or timezone. */
export type DateString = string;

export type Category =
  | "no-classes" // breaks and holidays when classes do not meet
  | "term" // semester/session start and end, classes resume
  | "exams" // final exams
  | "deadline" // last day to add/drop/withdraw, degree applications, etc.
  | "registration" // registration opens/closes
  | "other"; // everything else (observances, make-up days, partial cancellations)

export type TermSeason = "Fall" | "Spring" | "Summer" | "J-Term";

export type AcademicEvent = {
  /**
   * Stable identifier, e.g. "fall-2026-thanksgiving-break". Built from the
   * term and the rule key, never from the date or wording, so it survives
   * date changes. Used for ICS UIDs: changing it creates duplicates for
   * existing subscribers.
   */
  id: string;
  /** Short display title, e.g. "Thanksgiving Break". */
  title: string;
  /** Loyola's full original wording for the row. */
  description: string;
  category: Category;
  /** Term the event belongs to, e.g. "Fall 2026". */
  term: string;
  /** First day of the event. */
  start: DateString;
  /** Last day of the event, INCLUSIVE. Equal to `start` for one-day events. */
  end: DateString;
  /** Extra text Loyola attached to the date cell, e.g. "updated 3/10/2025". */
  note?: string;
  /**
   * Set when the source contradicts itself (e.g. the listed weekday does not
   * match the date). Shown to users so they verify with Loyola.
   */
  warning?: string;
  /** Page this event was read from. */
  sourceUrl: string;
  /** Bumped whenever start/end/title/description/category change (ICS SEQUENCE). */
  sequence: number;
  /** When this event's content last changed (ISO timestamp, ICS LAST-MODIFIED). */
  lastModified: string;
};

export type Term = {
  /** e.g. "fall-2026" */
  id: string;
  /** e.g. "Fall 2026" */
  name: string;
  season: TermSeason;
  year: number;
  /** First day of classes. */
  start: DateString;
  /** Last day of the term (end of finals, or last session end), inclusive. */
  end: DateString;
  /** Last day of regular classes, before finals (Fall/Spring only). */
  classesEnd?: DateString;
};

export type CalendarData = {
  source: {
    name: string;
    /** Loyola's official academic calendar page (the authoritative source). */
    officialUrl: string;
    /** Every page the data was read from. */
    pages: string[];
    /** When the source pages were fetched for the data currently published. */
    retrievedAt: string;
  };
  terms: Term[];
  events: AcademicEvent[];
};
