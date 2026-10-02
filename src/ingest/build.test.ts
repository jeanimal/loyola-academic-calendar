import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCalendarData } from "./build.ts";
import { parseSources, type ParsedEvent } from "./parse.ts";
import { SOURCE_PAGES } from "./sources.ts";
import { validate } from "./validate.ts";
import type { CalendarData } from "../lib/types.ts";

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}.html`, import.meta.url), "utf8");

const parsed = parseSources(
  ["fall", "spring", "summer"].map((name, i) => ({ page: SOURCE_PAGES[i]!, html: fixture(name) })),
);
const T1 = new Date("2026-10-02T12:00:00Z");
const T2 = new Date("2026-10-09T12:00:00Z");

function moveThanksgiving(events: ParsedEvent[]): ParsedEvent[] {
  return events.map((e) =>
    e.id === "fall-2026-thanksgiving-break" ? { ...e, start: "2026-11-26", end: "2026-11-29" } : e,
  );
}

describe("buildCalendarData", () => {
  const first = buildCalendarData(parsed, undefined, T1).data;

  it("produces valid data from Loyola's pages", () => {
    expect(validate(first)).toEqual([]);
    expect(first.terms.find((t) => t.id === "fall-2026")).toEqual({
      id: "fall-2026",
      name: "Fall 2026",
      season: "Fall",
      year: 2026,
      start: "2026-08-24",
      classesEnd: "2026-12-05",
      end: "2026-12-12",
    });
    expect(first.terms.find((t) => t.id === "summer-2026")).toMatchObject({ start: "2026-05-18", end: "2026-08-07" });
  });

  it("changes nothing (not even the timestamp) when the source is unchanged", () => {
    const again = buildCalendarData(parsed, first, T2);
    expect(again.changes).toEqual({ added: [], changed: [], removed: [] });
    expect(again.data).toEqual(first);
  });

  it("bumps SEQUENCE and LAST-MODIFIED only for changed events", () => {
    const { data, changes } = buildCalendarData(moveThanksgiving(parsed), first, T2);
    const moved = data.events.find((e) => e.id === "fall-2026-thanksgiving-break")!;
    expect(moved).toMatchObject({ sequence: 1, lastModified: "2026-10-09T12:00:00Z", start: "2026-11-26" });
    expect(changes.changed.map((c) => c.after.id)).toEqual(["fall-2026-thanksgiving-break"]);
    const untouched = data.events.find((e) => e.id === "fall-2026-final-exams")!;
    expect(untouched).toMatchObject({ sequence: 0, lastModified: "2026-10-02T12:00:00Z" });
    expect(data.source.retrievedAt).toBe("2026-10-09T12:00:00Z");
  });

  it("reports removed events", () => {
    const { changes } = buildCalendarData(parsed.filter((e) => e.term !== "Fall 2030"), first, T2);
    expect(changes.removed.length).toBeGreaterThan(15);
    expect(changes.removed.every((e) => e.term === "Fall 2030")).toBe(true);
  });
});

describe("validate", () => {
  const good = buildCalendarData(parsed, undefined, T1).data;
  const withEvents = (events: CalendarData["events"]): CalendarData => ({ ...good, events });

  it("flags too few events", () => {
    expect(validate(withEvents(good.events.slice(0, 20))).join("\n")).toMatch(/only 20 events/);
  });

  it("flags duplicate ids", () => {
    expect(validate(withEvents([...good.events, good.events[0]!])).join("\n")).toMatch(/duplicate event id/);
  });

  it("flags malformed or impossible dates", () => {
    const [a, b, ...rest] = good.events;
    const problems = validate(
      withEvents([{ ...a!, start: "2026-02-30" }, { ...b!, end: "2025-01-01" }, ...rest]),
    ).join("\n");
    expect(problems).toMatch(/invalid date/);
    expect(problems).toMatch(/ends before it starts/);
  });

  it("flags dates in the wrong season (e.g. a wrong-year parse)", () => {
    const events = good.events.map((e) =>
      e.id === "fall-2026-final-exams" ? { ...e, start: "2027-12-07", end: "2027-12-12" } : e,
    );
    expect(validate(withEvents(events)).join("\n")).toMatch(/fall-2026-final-exams: date 2027-12-07 is outside/);
  });

  it("flags a semester with no start or end", () => {
    const data = { ...good, terms: good.terms.filter((t) => t.id !== "spring-2028") };
    expect(validate(data).join("\n")).toMatch(/Spring 2028: missing term start or end/);
  });

  it("flags suspiciously long events", () => {
    const events = good.events.map((e) =>
      e.id === "fall-2026-thanksgiving-break" ? { ...e, end: "2026-12-28" } : e,
    );
    expect(validate(withEvents(events)).join("\n")).toMatch(/suspiciously long/);
  });
});
