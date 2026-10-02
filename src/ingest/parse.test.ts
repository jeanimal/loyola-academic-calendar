import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkWeekdays, parseDateCell, parseSources, SourceFormatError, type ParsedEvent } from "./parse.ts";
import { SOURCE_PAGES } from "./sources.ts";

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}.html`, import.meta.url), "utf8");

const FIXTURES = { fall: fixture("fall"), spring: fixture("spring"), summer: fixture("summer") };

function parseWith(overrides: Partial<typeof FIXTURES> = {}): ParsedEvent[] {
  const html = { ...FIXTURES, ...overrides };
  return parseSources([
    { page: SOURCE_PAGES[0]!, html: html.fall },
    { page: SOURCE_PAGES[1]!, html: html.spring },
    { page: SOURCE_PAGES[2]!, html: html.summer },
  ]);
}

function problemsFor(overrides: Partial<typeof FIXTURES>): string[] {
  try {
    parseWith(overrides);
  } catch (err) {
    if (err instanceof SourceFormatError) return err.problems;
    throw err;
  }
  throw new Error("expected parsing to fail");
}

describe("parseDateCell", () => {
  it.each([
    ["August 23", { start: "2026-08-23", end: "2026-08-23" }],
    ["October16", { start: "2026-10-16", end: "2026-10-16" }],
    ["October 5 - 6", { start: "2026-10-05", end: "2026-10-06" }],
    ["October 9 -10", { start: "2026-10-09", end: "2026-10-10" }],
    ["May 3 - May 8", { start: "2026-05-03", end: "2026-05-08" }],
    ["March 29 - April 2", { start: "2026-03-29", end: "2026-04-02" }],
    [" January 16 (Tuesday)", { start: "2026-01-16", end: "2026-01-16", statedWeekday: "Tuesday" }],
    ["November 9 (updated 3/10/2025)", { start: "2026-11-09", end: "2026-11-09", note: "updated 3/10/2025" }],
    ["March 6 NO CLASSES", { start: "2026-03-06", end: "2026-03-06", note: "NO CLASSES" }],
  ])("parses %j", (raw, expected) => {
    expect(parseDateCell(raw, 2026)).toEqual({ kind: "date", ...expected });
  });

  it("rolls a range over into the next year", () => {
    expect(parseDateCell("December 30 - January 2", 2026)).toMatchObject({ start: "2026-12-30", end: "2027-01-02" });
  });

  it.each(["TBA", "N/A", "", " "])("treats %j as no date", (raw) => {
    expect(parseDateCell(raw, 2026)).toEqual({ kind: "none" });
  });

  it.each(["Sometime in fall", "Febuary 3", "February 30", "October 9 - 2", "May 3 and May 10", "8/23/2026"])(
    "rejects %j",
    (raw) => {
      expect(typeof parseDateCell(raw, 2026)).toBe("string");
    },
  );
});

describe("checkWeekdays", () => {
  const cell = (start: string, end = start, statedWeekday?: string) =>
    ({ kind: "date", start, end, ...(statedWeekday ? { statedWeekday } : {}) }) as const;

  it("accepts matching weekdays", () => {
    expect(checkWeekdays(cell("2026-11-25", "2026-11-28"), "Wednesday - Saturday")).toBeUndefined();
    expect(checkWeekdays(cell("2026-09-08", "2026-09-08", "Tuesday"), "Monday (Tuesday, if Labor day)")).toBeUndefined();
    expect(checkWeekdays(cell("2026-08-31"), "Monday (Tuesday, if Labor day)")).toBeUndefined();
    expect(checkWeekdays(cell("2026-10-01"), "Varies")).toBeUndefined();
  });

  it("flags contradictions", () => {
    expect(checkWeekdays(cell("2027-01-02", "2027-01-02", "Friday"), "Varies")).toMatch(/Friday.*Saturday/);
    expect(checkWeekdays(cell("2026-11-24"), "Wednesday")).toMatch(/Wednesday.*Tuesday/);
    expect(checkWeekdays(cell("2026-11-25", "2026-11-27"), "Wednesday - Saturday")).toMatch(/ending on a Saturday/);
  });
});

describe("parseSources on Loyola's published pages", () => {
  const events = parseWith();
  const byId = (id: string) => events.find((e) => e.id === id);

  it("reads every term and a plausible number of events", () => {
    expect(events.length).toBeGreaterThan(250);
    const terms = new Set(events.map((e) => e.term));
    for (const t of ["Fall 2026", "Fall 2030", "Spring 2027", "Spring 2030", "Summer 2026", "Summer 2027"]) {
      expect(terms).toContain(t);
    }
  });

  it("gets key Fall 2026 dates right", () => {
    expect(byId("fall-2026-semester-begins")).toMatchObject({ start: "2026-08-24", end: "2026-08-24", category: "term" });
    expect(byId("fall-2026-thanksgiving-break")).toMatchObject({ start: "2026-11-25", end: "2026-11-28", category: "no-classes" });
    expect(byId("fall-2026-mid-semester-break")).toMatchObject({ start: "2026-10-05", end: "2026-10-06" });
    expect(byId("fall-2026-classes-end")).toMatchObject({ start: "2026-12-05" });
    expect(byId("fall-2026-final-exams")).toMatchObject({ start: "2026-12-07", end: "2026-12-12", category: "exams" });
    expect(byId("fall-2026-spring-registration-begins")?.note).toBe("updated 3/10/2025");
  });

  it("handles ranges that cross months and odd spacing", () => {
    expect(byId("spring-2029-easter-break")).toMatchObject({ start: "2029-03-29", end: "2029-04-02" });
    expect(byId("fall-2028-mid-semester-break")).toMatchObject({ start: "2028-10-09", end: "2028-10-10" }); // "October 9 -10"
    expect(byId("fall-2028-j-term-registration-begins")).toMatchObject({ start: "2028-10-16" }); // "October16"
    expect(byId("spring-2027-final-exams")).toMatchObject({ start: "2027-05-03", end: "2027-05-08" }); // "May 3 - May 8"
  });

  it("skips TBA/N/A cells and ignored tables", () => {
    expect(byId("summer-2027-juneteenth-makeup")).toBeUndefined(); // "N/A"
    expect(byId("summer-2026-juneteenth-makeup")).toMatchObject({ start: "2026-06-26" });
    expect(events.some((e) => e.term.startsWith("J-Term"))).toBe(false);
    // Fall's preview of Spring is ignored, so Spring dates come only from the Spring page.
    expect(events.filter((e) => e.id === "spring-2027-semester-begins")).toHaveLength(1);
  });

  it("produces unique ids", () => {
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
  });
});

describe("parseSources fails loudly on page changes", () => {
  it("rejects an unknown row label", () => {
    const fall = FIXTURES.fall.replace("Fall semester begins</td>", "Fall classes start</td>");
    expect(problemsFor({ fall }).join("\n")).toMatch(/no rule matches row label "Fall classes start"/);
  });

  it("rejects an unreadable date", () => {
    const fall = FIXTURES.fall.replace("<strong>November 25 - 28</strong>", "<strong>Nov. 25-28</strong>");
    expect(problemsFor({ fall }).join("\n")).toMatch(/unreadable date "Nov. 25-28"/);
  });

  it("rejects a weekday that contradicts the date", () => {
    const fall = FIXTURES.fall.replace("<strong>November 25 - 28</strong>", "<strong>November 24 - 27</strong>");
    expect(problemsFor({ fall }).join("\n")).toMatch(/Thanksgiving.*Wednesday.*Tuesday/);
  });

  it("rejects a missing table", () => {
    const fall = FIXTURES.fall.replace("Regular FALL Semesters", "Autumn Semesters");
    const problems = problemsFor({ fall }).join("\n");
    expect(problems).toMatch(/unexpected calendar table "Autumn Semesters"/);
    expect(problems).toMatch(/expected exactly one table titled/);
  });

  it("rejects a changed header row", () => {
    const summer = FIXTURES.summer.replaceAll(">Day<", ">Weekday<");
    expect(problemsFor({ summer }).join("\n")).toMatch(/no calendar tables found/);
  });

  it("rejects a row with the wrong number of cells", () => {
    const fall = FIXTURES.fall.replace(
      '<td style="text-align: center;">December 9 - 14</td>',
      "",
    );
    expect(problemsFor({ fall }).join("\n")).toMatch(/"Final Exams.*has 4 date cells, expected 5/);
  });

  it("rejects the wrong page", () => {
    expect(problemsFor({ fall: FIXTURES.spring }).join("\n")).toMatch(/unexpected page heading/);
  });

  it("rejects an empty page", () => {
    expect(problemsFor({ summer: "<html><body><h1>Summer Sessions Academic Calendar</h1></body></html>" }).join("\n")).toMatch(
      /no calendar tables found/,
    );
  });
});
