import { describe, expect, it } from "vitest";
import data from "../../data/academic-calendar.json";
import { FEEDS, renderFeed } from "./feeds.ts";
import { buildIcs, escapeText, foldLine } from "./ics.ts";
import type { AcademicEvent, CalendarData } from "./types.ts";

const OPTIONS = { name: "Test", description: "Test calendar", uidDomain: "test.example", sourceUrl: "https://example.edu/cal" };

function event(overrides: Partial<AcademicEvent> = {}): AcademicEvent {
  return {
    id: "fall-2026-thanksgiving-break",
    title: "Thanksgiving Break",
    description: "Thanksgiving Break: No classes",
    category: "no-classes",
    term: "Fall 2026",
    start: "2026-11-25",
    end: "2026-11-28",
    sourceUrl: "https://example.edu/cal",
    sequence: 0,
    lastModified: "2026-10-02T20:40:34Z",
    ...overrides,
  };
}

/** Unfold lines and return the VEVENT blocks as property maps. */
function parseEvents(ics: string): Record<string, string>[] {
  const lines = ics.replace(/\r\n /g, "").split("\r\n");
  const events: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") current = {};
    else if (line === "END:VEVENT") {
      events.push(current!);
      current = null;
    } else if (current) {
      const i = line.indexOf(":");
      current[line.slice(0, i)] = line.slice(i + 1);
    }
  }
  return events;
}

describe("all-day event dates", () => {
  it("writes multi-day events with an exclusive DTEND", () => {
    const [e] = parseEvents(buildIcs([event()], OPTIONS));
    expect(e!["DTSTART;VALUE=DATE"]).toBe("20261125");
    // Nov 25–28 inclusive → DTEND is Nov 29.
    expect(e!["DTEND;VALUE=DATE"]).toBe("20261129");
  });

  it("writes one-day events as a single day", () => {
    const [e] = parseEvents(buildIcs([event({ start: "2026-12-05", end: "2026-12-05" })], OPTIONS));
    expect(e!["DTSTART;VALUE=DATE"]).toBe("20261205");
    expect(e!["DTEND;VALUE=DATE"]).toBe("20261206");
  });

  it("handles month and year boundaries", () => {
    const [a, b] = parseEvents(
      buildIcs(
        [
          event({ id: "a", start: "2029-03-29", end: "2029-03-31" }),
          event({ id: "b", start: "2026-12-30", end: "2026-12-31" }),
        ],
        OPTIONS,
      ),
    ).sort((x, y) => x.UID!.localeCompare(y.UID!));
    expect(a!["DTEND;VALUE=DATE"]).toBe("20290401");
    expect(b!["DTEND;VALUE=DATE"]).toBe("20270101");
  });

  it("never emits times or timezones on event dates", () => {
    const ics = renderFeed(FEEDS[1]!, data as CalendarData);
    expect(ics).not.toMatch(/^DT(START|END)(?!;VALUE=DATE:\d{8}\r$)/m);
    expect(ics).not.toContain("TZID");
  });
});

describe("UIDs", () => {
  it("are derived from the event id, not the date or wording", () => {
    const before = parseEvents(buildIcs([event()], OPTIONS))[0]!;
    const after = parseEvents(
      buildIcs([event({ start: "2026-11-26", end: "2026-11-29", title: "Thanksgiving Recess", sequence: 1 })], OPTIONS),
    )[0]!;
    expect(before.UID).toBe("fall-2026-thanksgiving-break@test.example");
    expect(after.UID).toBe(before.UID);
    expect(after.SEQUENCE).toBe("1");
  });

  it("are unique within each published feed and differ between feeds", () => {
    const uidsByFeed = FEEDS.map((feed) => parseEvents(renderFeed(feed, data as CalendarData)).map((e) => e.UID!));
    for (const uids of uidsByFeed) expect(new Set(uids).size).toBe(uids.length);
    const [key, all] = uidsByFeed;
    expect(key!.some((uid) => all!.includes(uid))).toBe(false);
  });

  it("keep their published format (changing it would duplicate subscribers' events)", () => {
    const ics = renderFeed(FEEDS.find((f) => f.id === "all")!, data as CalendarData);
    expect(ics).toContain("UID:fall-2026-thanksgiving-break@loyola-academic-calendar\r\n");
  });
});

describe("iCalendar formatting", () => {
  it("escapes TEXT values", () => {
    expect(escapeText('a,b;c\\d\ne')).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("folds long lines at 75 octets without splitting UTF-8 characters", () => {
    const line = "DESCRIPTION:" + "Café “quoted” ⚠ ".repeat(20);
    const folded = foldLine(line);
    const encoder = new TextEncoder();
    for (const part of folded.split("\r\n")) expect(encoder.encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("uses CRLF line endings throughout and wraps events in a VCALENDAR", () => {
    const ics = buildIcs([event()], OPTIONS);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("includes required properties and a link back to Loyola", () => {
    const [e] = parseEvents(buildIcs([event({ note: "updated 3/10/2025" })], OPTIONS));
    expect(e).toMatchObject({
      DTSTAMP: "20261002T204034Z",
      SUMMARY: "Thanksgiving Break (no classes)",
      URL: "https://example.edu/cal",
      TRANSP: "TRANSPARENT",
    });
    expect(e!.DESCRIPTION).toContain("Unofficial calendar");
    expect(e!.DESCRIPTION).toContain("updated 3/10/2025");
    expect(e!.DESCRIPTION).toContain("https://example.edu/cal");
  });

  it("suggests a calendar color only when one is given", () => {
    expect(buildIcs([event()], OPTIONS)).not.toContain("X-APPLE-CALENDAR-COLOR");
    expect(buildIcs([event()], { ...OPTIONS, color: "#8A1538" })).toContain("\r\nX-APPLE-CALENDAR-COLOR:#8A1538\r\n");
  });

  it("is deterministic", () => {
    const d = data as CalendarData;
    expect(renderFeed(FEEDS[0]!, d)).toBe(renderFeed(FEEDS[0]!, d));
  });

  it("key-dates feed has only breaks, term dates and exams", () => {
    const keyFeed = FEEDS.find((f) => f.id === "key")!;
    const summaries = parseEvents(renderFeed(keyFeed, data as CalendarData)).map((e) => e.CATEGORIES);
    expect(new Set(summaries)).toEqual(new Set(["No classes", "Term dates", "Final exams"]));
  });
});
