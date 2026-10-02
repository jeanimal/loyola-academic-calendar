/**
 * RFC 5545 iCalendar output for all-day academic events.
 *
 * Key rules (and the reasons):
 * - Dates use DTSTART;VALUE=DATE / DTEND;VALUE=DATE with no time and no
 *   timezone, so every client shows the event on the same calendar day.
 * - DTEND is EXCLUSIVE in iCalendar: a Nov 25–28 break is written as
 *   DTSTART 20261125, DTEND 20261129. Our data stores inclusive ends, so we
 *   add one day here and only here.
 * - UID is derived from the event's stable id, so a date change updates the
 *   existing event in subscribers' calendars rather than duplicating it.
 * - Output is deterministic (DTSTAMP comes from the event's lastModified),
 *   so regenerating unchanged data yields a byte-identical file.
 */
import { addDays, toIcsDate } from "./dates.ts";
import type { AcademicEvent } from "./types.ts";
import { categoryLabel } from "./categories.ts";

export type IcsCalendarOptions = {
  name: string;
  description: string;
  /** Appended to event ids to form UIDs: "<id>@<uidDomain>". Never change it. */
  uidDomain: string;
  /** Official source, linked from the calendar and every event. */
  sourceUrl: string;
  /** Public page for this viewer, if known. */
  siteUrl?: string;
  /** Suggested calendar color ("#RRGGBB"); Apple Calendar applies it when subscribing. */
  color?: string;
};

const CRLF = "\r\n";

/** Escape a TEXT value (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold a content line to at most 75 octets per line (RFC 5545 §3.1),
 * never splitting a multi-byte UTF-8 character.
 */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    // Continuation lines start with a space, which counts toward the 75.
    const limit = out.length === 0 ? 75 : 74;
    if (currentBytes + bytes > limit) {
      out.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  out.push(current);
  return out.join(CRLF + " ");
}

/** "2026-10-02T20:40:34Z" → "20261002T204034Z" */
export function toIcsTimestamp(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(iso);
  if (!m) throw new Error(`Expected a UTC ISO timestamp, got "${iso}"`);
  return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6]}Z`;
}

export function eventSummary(event: AcademicEvent): string {
  return event.category === "no-classes" ? `${event.title} (no classes)` : event.title;
}

export function eventDescription(event: AcademicEvent, sourceUrl: string): string {
  const lines = [`Loyola's wording: ${event.description}`];
  if (event.note) lines.push(`Note from Loyola: ${event.note}`);
  if (event.warning) lines.push(`⚠ ${event.warning}`);
  lines.push(
    "",
    `${event.term} · ${categoryLabel(event.category)}`,
    "",
    "Unofficial calendar, not affiliated with Loyola University Chicago. Verify important dates with Loyola's official academic calendar:",
    event.sourceUrl || sourceUrl,
  );
  return lines.join("\n");
}

export function buildIcs(events: AcademicEvent[], options: IcsCalendarOptions): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//loyola-academic-calendar//Unofficial LUC Academic Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `NAME:${escapeText(options.name)}`,
    `X-WR-CALNAME:${escapeText(options.name)}`,
    `DESCRIPTION:${escapeText(options.description)}`,
    `X-WR-CALDESC:${escapeText(options.description)}`,
    `URL:${options.siteUrl ?? options.sourceUrl}`,
    // Hints for clients that honor them (Apple, Outlook); Google ignores them.
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];
  if (options.color) lines.push(`X-APPLE-CALENDAR-COLOR:${options.color}`);

  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  for (const event of sorted) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@${options.uidDomain}`,
      `DTSTAMP:${toIcsTimestamp(event.lastModified)}`,
      `LAST-MODIFIED:${toIcsTimestamp(event.lastModified)}`,
      `SEQUENCE:${event.sequence}`,
      `DTSTART;VALUE=DATE:${toIcsDate(event.start)}`,
      `DTEND;VALUE=DATE:${toIcsDate(addDays(event.end, 1))}`,
      `SUMMARY:${escapeText(eventSummary(event))}`,
      `DESCRIPTION:${escapeText(eventDescription(event, options.sourceUrl))}`,
      `CATEGORIES:${escapeText(categoryLabel(event.category))}`,
      `URL:${event.sourceUrl || options.sourceUrl}`,
      // All-day academic dates shouldn't mark anyone as busy.
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}
