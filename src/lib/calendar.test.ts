import { describe, expect, it } from "vitest";
import { layoutWeek, monthFromHash, monthWeeks, nextEvent, termStatus } from "./calendar.ts";
import type { AcademicEvent, Term } from "./types.ts";

const ev = (id: string, start: string, end = start, category: AcademicEvent["category"] = "deadline"): AcademicEvent => ({
  id,
  title: id,
  description: id,
  category,
  term: "Fall 2026",
  start,
  end,
  sourceUrl: "",
  sequence: 0,
  lastModified: "2026-10-02T00:00:00Z",
});

describe("monthWeeks", () => {
  it("covers the month in Sunday-start weeks", () => {
    const weeks = monthWeeks("2026-11-01"); // Nov 1, 2026 is a Sunday
    expect(weeks[0]![0]).toBe("2026-11-01");
    expect(weeks.at(-1)!.at(-1)).toBe("2026-12-05");
    expect(weeks).toHaveLength(5);
    expect(monthWeeks("2026-10-01")[0]![0]).toBe("2026-09-27");
  });
});

describe("layoutWeek", () => {
  it("clips multi-day events to the week and marks continuations", () => {
    // Week of Sun Mar 25, 2029; Easter Break runs Thu Mar 29 – Mon Apr 2.
    const [seg] = layoutWeek("2029-03-25", [ev("easter", "2029-03-29", "2029-04-02")]);
    expect(seg).toMatchObject({ column: 4, span: 3, continuesBefore: false, continuesAfter: true });
    const [next] = layoutWeek("2029-04-01", [ev("easter", "2029-03-29", "2029-04-02")]);
    expect(next).toMatchObject({ column: 0, span: 2, continuesBefore: true, continuesAfter: false });
  });

  it("stacks overlapping events in separate lanes and reuses free lanes", () => {
    const segments = layoutWeek("2026-11-22", [
      ev("break", "2026-11-25", "2026-11-28"),
      ev("same-day", "2026-11-25"),
      ev("monday", "2026-11-23"),
    ]);
    const lane = (id: string) => segments.find((s) => s.event.id === id)!.lane;
    expect(lane("monday")).toBe(0);
    expect(lane("break")).toBe(0);
    expect(lane("same-day")).toBe(1);
  });

  it("ignores events outside the week", () => {
    expect(layoutWeek("2026-11-22", [ev("x", "2026-11-29")])).toEqual([]);
  });
});

describe("summaries", () => {
  const fall: Term = { id: "fall-2026", name: "Fall 2026", season: "Fall", year: 2026, start: "2026-08-24", end: "2026-12-12", classesEnd: "2026-12-05" };
  const spring: Term = { id: "spring-2027", name: "Spring 2027", season: "Spring", year: 2027, start: "2027-01-19", end: "2027-05-08" };

  it("finds the next event, including one in progress", () => {
    const events = [ev("past", "2026-09-07"), ev("now", "2026-10-05", "2026-10-06"), ev("later", "2026-11-25")];
    expect(nextEvent(events, "2026-10-02", () => true)?.id).toBe("now");
    expect(nextEvent(events, "2026-10-06", () => true)?.id).toBe("now");
    expect(nextEvent(events, "2026-10-07", () => true)?.id).toBe("later");
  });

  it("reports week of term and the gap between terms", () => {
    expect(termStatus([fall, spring], "2026-08-24")).toMatchObject({ kind: "in-term", week: 1, totalWeeks: 16 });
    expect(termStatus([fall, spring], "2026-10-02")).toMatchObject({ kind: "in-term", week: 6 });
    expect(termStatus([fall, spring], "2026-12-20")).toMatchObject({ kind: "between-terms", daysUntil: 30 });
    expect(termStatus([fall], "2027-01-01")).toEqual({ kind: "none" });
  });

  it("parses month hashes defensively", () => {
    expect(monthFromHash("#2026-11")).toBe("2026-11-01");
    expect(monthFromHash("#2026-13")).toBeUndefined();
    expect(monthFromHash("#nope")).toBeUndefined();
  });
});
