/**
 * The published .ics feeds. File names and uidDomains are part of the public
 * contract: subscribers' calendars point at these URLs, and changing a
 * uidDomain would duplicate every event. Don't rename either.
 */
import { isKeyDate } from "./categories.ts";
import { buildIcs } from "./ics.ts";
import type { AcademicEvent, CalendarData } from "./types.ts";

export type Feed = {
  id: "all" | "key";
  file: string;
  label: string;
  summary: string;
  calendarName: string;
  uidDomain: string;
  include: (event: AcademicEvent) => boolean;
};

export const FEEDS: Feed[] = [
  {
    id: "key",
    file: "loyola-academic-calendar-key-dates.ics",
    label: "Key dates",
    summary: "Breaks, first and last days of classes, and finals. Best for families.",
    calendarName: "Loyola Key Dates (Unofficial)",
    uidDomain: "key-dates.loyola-academic-calendar",
    include: isKeyDate,
  },
  {
    id: "all",
    file: "loyola-academic-calendar.ics",
    label: "All dates",
    summary: "Everything above plus registration and add/drop/withdrawal deadlines.",
    calendarName: "Loyola Academic Calendar (Unofficial)",
    uidDomain: "loyola-academic-calendar",
    include: () => true,
  },
];

export function renderFeed(feed: Feed, data: CalendarData, siteUrl?: string): string {
  return buildIcs(data.events.filter(feed.include), {
    name: feed.calendarName,
    description:
      "Unofficial Loyola University Chicago undergraduate academic calendar. " +
      "Not affiliated with or endorsed by Loyola. Verify important dates at " +
      data.source.officialUrl,
    uidDomain: feed.uidDomain,
    sourceUrl: data.source.officialUrl,
    ...(siteUrl ? { siteUrl } : {}),
  });
}
