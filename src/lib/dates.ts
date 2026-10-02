/**
 * Date-only helpers. Every function here works on "YYYY-MM-DD" strings and
 * uses UTC internally, so the user's timezone can never shift a date by a
 * day. Don't use `new Date("2026-11-25")` + local getters anywhere else.
 */
import type { DateString } from "./types.ts";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Build a DateString from numeric parts, validating that the date exists. */
export function makeDate(year: number, month: number, day: number): DateString {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: ${year}-${month}-${day}`);
  }
  return toDateString(d);
}

export function isDateString(value: string): boolean {
  const m = ISO_DATE.exec(value);
  if (!m) return false;
  try {
    makeDate(Number(m[1]), Number(m[2]), Number(m[3]));
    return true;
  } catch {
    return false;
  }
}

function toUtc(date: DateString): Date {
  const m = ISO_DATE.exec(date);
  if (!m) throw new Error(`Not a YYYY-MM-DD date: ${date}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function toDateString(d: Date): DateString {
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parts(date: DateString): { year: number; month: number; day: number } {
  const d = toUtc(date);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function addDays(date: DateString, days: number): DateString {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateString(d);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: DateString, b: DateString): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(date: DateString): number {
  return toUtc(date).getUTCDay();
}

export function weekdayName(date: DateString): string {
  return WEEKDAYS[weekday(date)]!;
}

/** First day of the month containing `date`. */
export function startOfMonth(date: DateString): DateString {
  const { year, month } = parts(date);
  return makeDate(year, month, 1);
}

export function addMonths(monthStart: DateString, months: number): DateString {
  const { year, month } = parts(monthStart);
  const index = year * 12 + (month - 1) + months;
  return makeDate(Math.floor(index / 12), (index % 12) + 1, 1);
}

/** The local "today" of the person viewing the site, as a DateString. */
export function todayLocal(now: Date = new Date()): DateString {
  return makeDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** "YYYYMMDD" for ICS VALUE=DATE properties. */
export function toIcsDate(date: DateString): string {
  return date.replaceAll("-", "");
}

// ---- Display formatting (no Intl/timezone involvement) ----

/** "Wed, Nov 25" */
export function formatShort(date: DateString, withWeekday = true): string {
  const { month, day } = parts(date);
  const md = `${MONTHS[month - 1]!.slice(0, 3)} ${day}`;
  return withWeekday ? `${weekdayName(date).slice(0, 3)}, ${md}` : md;
}

/** "Wednesday, November 25, 2026" */
export function formatLong(date: DateString): string {
  const { year, month, day } = parts(date);
  return `${weekdayName(date)}, ${MONTHS[month - 1]} ${day}, ${year}`;
}

/** "Nov 25", "Nov 25 – 28", "Mar 29 – Apr 2" */
export function formatRange(start: DateString, end: DateString, withWeekday = false): string {
  if (start === end) return formatShort(start, withWeekday);
  const a = parts(start);
  const b = parts(end);
  if (!withWeekday && a.year === b.year && a.month === b.month) {
    return `${formatShort(start, false)} – ${b.day}`;
  }
  return `${formatShort(start, withWeekday)} – ${formatShort(end, withWeekday)}`;
}

export function formatMonthYear(monthStart: DateString): string {
  const { year, month } = parts(monthStart);
  return `${MONTHS[month - 1]} ${year}`;
}
