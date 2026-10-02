import type { TermSeason } from "../lib/types.ts";

export const OFFICIAL_CALENDAR_URL =
  "https://www.luc.edu/academics/schedules/fall/academic_calendar.shtml";

export type SourcePage = {
  url: string;
  /** The page's <h1> must match, or we're probably looking at the wrong page. */
  heading: RegExp;
  /**
   * Calendar tables to read, identified by their title row (or, for tables
   * with no title row, the first header cell). Each must appear exactly once.
   */
  tables: { title: RegExp; season: TermSeason }[];
  /**
   * Calendar tables we know about and intentionally skip (usually short
   * previews of another page). Any calendar table that matches neither list
   * is treated as a page change and fails generation.
   */
  ignoredTables: RegExp[];
};

/**
 * Loyola's undergraduate calendar is split across three pages that share
 * the same layout: one row per event, one column per year.
 */
export const SOURCE_PAGES: SourcePage[] = [
  {
    url: OFFICIAL_CALENDAR_URL,
    heading: /^Fall \d{4} - \d{4} Academic Calendars?$/i,
    tables: [{ title: /^Regular Fall Semesters$/i, season: "Fall" }],
    ignoredTables: [
      // Preview of the Spring page.
      /^Regular Spring Semesters$/i,
      // Skipped deliberately (checked 2026-10-02): the columns are labeled
      // 2027/2028, but the weekdays given ("January 2 (Friday)",
      // "January 4 (Monday)") only fit 2026/2027, so we can't tell which
      // year each date belongs to. To include it again, move this to
      // `tables` with season "J-Term" once Loyola's table is consistent.
      /^J-Terms?$/i,
    ],
  },
  {
    url: "https://www.luc.edu/academics/schedules/spring/academic_calendar.shtml",
    heading: /^Spring \d{4} - \d{4} Academic Calendars?$/i,
    tables: [{ title: /^Regular Spring Semesters$/i, season: "Spring" }],
    ignoredTables: [
      // Mostly "TBA"; free-form cells that aren't reliably parseable.
      /^Graduation Events and Ceremonies$/i,
      // Previews of the Summer and Fall pages.
      /^Summer Semesters$/i,
      /^Regular Fall Semesters$/i,
    ],
  },
  {
    url: "https://www.luc.edu/academics/schedules/summer/academic_calendar.shtml",
    heading: /^Summer Sessions Academic Calendars?$/i,
    // This table has no title row; its first header cell reads "Key Event".
    tables: [{ title: /^Key Event$/i, season: "Summer" }],
    ignoredTables: [],
  },
];
