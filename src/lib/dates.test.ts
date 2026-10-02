import { afterEach, describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  daysBetween,
  formatRange,
  isDateString,
  makeDate,
  todayLocal,
  weekdayName,
} from "./dates.ts";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

describe("date-only helpers", () => {
  it("rejects dates that don't exist", () => {
    expect(() => makeDate(2027, 2, 29)).toThrow();
    expect(() => makeDate(2026, 4, 31)).toThrow();
    expect(makeDate(2028, 2, 29)).toBe("2028-02-29");
    expect(isDateString("2026-13-01")).toBe(false);
    expect(isDateString("2026-1-5")).toBe(false);
  });

  it("adds days across month, year and DST boundaries", () => {
    expect(addDays("2026-11-28", 1)).toBe("2026-11-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    // US DST starts 2026-03-08 and ends 2026-11-01.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
    expect(daysBetween("2026-03-01", "2026-03-31")).toBe(30);
  });

  it("gives the same answers in any timezone", () => {
    for (const tz of ["UTC", "America/Chicago", "Pacific/Honolulu", "Pacific/Kiritimati", "Asia/Kolkata"]) {
      process.env.TZ = tz;
      expect(weekdayName("2026-11-25"), tz).toBe("Wednesday");
      expect(addDays("2026-11-28", 1), tz).toBe("2026-11-29");
      expect(addMonths("2026-12-01", 1), tz).toBe("2027-01-01");
    }
  });

  it("computes the viewer's local today from local date parts", () => {
    process.env.TZ = "Pacific/Honolulu";
    // 2026-10-03T05:00Z is still Oct 2 in Honolulu.
    expect(todayLocal(new Date("2026-10-03T05:00:00Z"))).toBe("2026-10-02");
  });

  it("formats ranges compactly", () => {
    expect(formatRange("2026-11-25", "2026-11-25")).toBe("Nov 25");
    expect(formatRange("2026-11-25", "2026-11-28")).toBe("Nov 25 – 28");
    expect(formatRange("2029-03-29", "2029-04-02")).toBe("Mar 29 – Apr 2");
    expect(formatRange("2026-11-25", "2026-11-28", true)).toBe("Wed, Nov 25 – Sat, Nov 28");
  });
});
