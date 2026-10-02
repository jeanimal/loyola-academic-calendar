/**
 * Turns Loyola's academic-calendar HTML into normalized events.
 *
 * This is deliberately strict. Anything it doesn't recognize (an unknown
 * table, a row label with no rule, a date it can't read, a weekday that
 * contradicts the date) is collected as an error, and `parseSources` throws
 * with the full list. Publishing nothing beats publishing wrong dates.
 */
import { parse, type HTMLElement } from "node-html-parser";
import { MONTHS, WEEKDAYS, makeDate, weekdayName, formatLong } from "../lib/dates.ts";
import type { AcademicEvent, DateString, TermSeason } from "../lib/types.ts";
import { ACKNOWLEDGED_SOURCE_ISSUES, RULES, type Rule } from "./rules.ts";
import type { SourcePage } from "./sources.ts";

/** An event before revision tracking (sequence/lastModified) is added. */
export type ParsedEvent = Omit<AcademicEvent, "sequence" | "lastModified"> & {
  role?: Rule["role"];
  season: TermSeason;
  year: number;
};

export class SourceFormatError extends Error {
  constructor(public readonly problems: string[]) {
    super(
      `Loyola's calendar page could not be parsed safely (${problems.length} problem${
        problems.length === 1 ? "" : "s"
      }):\n` + problems.map((p) => `  - ${p}`).join("\n"),
    );
    this.name = "SourceFormatError";
  }
}

// ---------------------------------------------------------------------------
// Text helpers

/** Cell text with <br>/<p> boundaries kept as spaces and whitespace collapsed. */
function cellText(cell: HTMLElement): string {
  const html = cell.innerHTML.replace(/<br\s*\/?>|<\/p>|<\/li>/gi, " ");
  return normalizeText(parse(html).textContent);
}

export function normalizeText(text: string): string {
  return text
    .replace(/[   ]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Date cells

export type ParsedDateCell =
  | { kind: "none" } // TBA, N/A or blank
  | {
      kind: "date";
      start: DateString;
      end: DateString;
      /** Weekday Loyola wrote in parentheses, e.g. "(Tuesday)". */
      statedWeekday?: string;
      /** Any other text in the cell, e.g. "updated 3/10/2025". */
      note?: string;
    };

const MONTH_PATTERN = MONTHS.join("|");
const DATE_CELL = new RegExp(
  `^(${MONTH_PATTERN})\\s*(\\d{1,2})` + // "October 5" / "October16"
    `(?:\\s*-\\s*(?:(${MONTH_PATTERN})\\s*)?(\\d{1,2}))?` + // " - 6" / " - April 2"
    `(.*)$`, // remainder: "(Tuesday)", "(updated 3/10/2025)", "NO CLASSES"
  "i",
);
const NO_DATE = /^(TBA|TBD|N\/A|-*)$/i;

function monthNumber(name: string): number {
  return MONTHS.findIndex((m) => m.toLowerCase() === name.toLowerCase()) + 1;
}

/**
 * Parse one date cell for a given year column. Returns an error string
 * instead of throwing so the caller can report every problem at once.
 */
export function parseDateCell(raw: string, year: number): ParsedDateCell | string {
  const text = normalizeText(raw);
  if (NO_DATE.test(text)) return { kind: "none" };

  const m = DATE_CELL.exec(text);
  if (!m) return `unreadable date "${raw}"`;
  const [, startMonthName, startDay, endMonthName, endDay, rest = ""] = m;

  const startMonth = monthNumber(startMonthName!);
  const endMonth = endMonthName ? monthNumber(endMonthName) : startMonth;
  // A range like "December 30 - January 2" continues into the next year.
  const endYear = endMonth < startMonth ? year + 1 : year;

  let start: DateString;
  let end: DateString;
  try {
    start = makeDate(year, startMonth, Number(startDay));
    end = endDay ? makeDate(endYear, endMonth, Number(endDay)) : start;
  } catch {
    return `impossible date "${raw}" for ${year}`;
  }
  if (end < start) return `date range ends before it starts: "${raw}"`;

  let statedWeekday: string | undefined;
  const notes: string[] = [];
  const remainder = rest.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    const word = inner.trim();
    const weekdayMatch = WEEKDAYS.find((w) => w.toLowerCase() === word.toLowerCase());
    if (weekdayMatch) statedWeekday = weekdayMatch;
    else notes.push(word);
    return " ";
  });
  const leftover = normalizeText(remainder);
  if (leftover) {
    // Guard against a second date we'd otherwise silently ignore,
    // e.g. "May 3 and May 10".
    if (new RegExp(`\\b(${MONTH_PATTERN})\\b`, "i").test(leftover)) {
      return `cell contains more than one date: "${raw}"`;
    }
    notes.push(leftover);
  }

  return {
    kind: "date",
    start,
    end,
    ...(statedWeekday ? { statedWeekday } : {}),
    ...(notes.length ? { note: notes.join("; ") } : {}),
  };
}

/** Weekday names that appear in a "Day" column value, in order. */
function weekdaysIn(dayColumn: string): string[] {
  // Ignore parenthetical alternatives: "Monday (Tuesday, if Labor day)".
  const main = dayColumn.replace(/\(.*?\)/g, " ");
  const found = main.match(new RegExp(`\\b(${WEEKDAYS.join("|")})\\b`, "gi")) ?? [];
  return found.map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase());
}

/**
 * Cross-check the parsed dates against the weekdays Loyola printed.
 * Returns a human-readable contradiction, or undefined if consistent.
 */
function mismatch(stated: string, date: DateString, ending = false): string {
  const actual = weekdayName(date);
  const written = formatLong(date).slice(actual.length + 2); // drop "Monday, "
  return `Loyola lists this as ${ending ? "ending on a " : ""}${stated}, but ${written} is a ${actual}.`;
}

export function checkWeekdays(
  cell: Extract<ParsedDateCell, { kind: "date" }>,
  dayColumn: string,
): string | undefined {
  const actualStart = weekdayName(cell.start);
  if (cell.statedWeekday) {
    return cell.statedWeekday === actualStart ? undefined : mismatch(cell.statedWeekday, cell.start);
  }
  if (/^varies/i.test(dayColumn)) return undefined;
  const listed = weekdaysIn(dayColumn);
  if (listed.length === 0) return undefined;
  if (listed[0] !== actualStart) return mismatch(listed[0]!, cell.start);
  const lastListed = listed.at(-1)!;
  if (cell.end !== cell.start && listed.length > 1 && lastListed !== weekdayName(cell.end)) {
    return mismatch(lastListed, cell.end, true);
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Tables

type CalendarTable = {
  title: string;
  years: number[];
  rows: { label: string; day: string; cells: string[] }[];
};

const YEAR = /^\d{4}$/;

/**
 * Find the tables that look like calendar tables: a header row of
 * "<blank or Key Event> | Day | 2026 | 2027 ...". Other tables on the page
 * (e.g. links to graduate-school calendars) are not calendar tables.
 */
export function findCalendarTables(root: HTMLElement): CalendarTable[] {
  const tables: CalendarTable[] = [];
  for (const table of root.querySelectorAll("table")) {
    const rows = table
      .querySelectorAll("tr")
      .map((tr) => tr.querySelectorAll("td, th").map(cellText));
    const headerIndex = rows.findIndex(
      (cells) =>
        cells.length >= 3 &&
        cells[1]?.toLowerCase() === "day" &&
        cells.slice(2).every((c) => YEAR.test(c)),
    );
    if (headerIndex === -1) continue;
    const header = rows[headerIndex]!;
    const title = normalizeText(
      headerIndex > 0 ? rows.slice(0, headerIndex).flat().join(" ") : header[0]!,
    );
    tables.push({
      title,
      years: header.slice(2).map(Number),
      rows: rows.slice(headerIndex + 1).map((cells) => ({
        label: cells[0] ?? "",
        day: cells[1] ?? "",
        cells: cells.slice(2),
      })),
    });
  }
  return tables;
}

export function termId(season: TermSeason, year: number): string {
  return `${season.toLowerCase()}-${year}`;
}

export function termName(season: TermSeason, year: number): string {
  return `${season} ${year}`;
}

function findRule(season: TermSeason, label: string): Rule[] {
  return RULES[season].filter((r) => r.match.test(label));
}

/** Parse one fetched page into events, appending any problems found. */
export function parsePage(page: SourcePage, html: string, problems: string[]): ParsedEvent[] {
  const where = page.url.replace(/^https?:\/\/(www\.)?/, "");
  const root = parse(html);

  const h1 = normalizeText(root.querySelector("h1")?.textContent ?? "");
  if (!page.heading.test(h1)) {
    problems.push(`${where}: unexpected page heading "${h1 || "(none)"}"`);
  }

  const tables = findCalendarTables(root);
  if (tables.length === 0) {
    problems.push(`${where}: no calendar tables found (page layout changed?)`);
    return [];
  }

  for (const table of tables) {
    const known =
      page.tables.some((t) => t.title.test(table.title)) ||
      page.ignoredTables.some((t) => t.test(table.title));
    if (!known) problems.push(`${where}: unexpected calendar table "${table.title}"`);
  }

  const events: ParsedEvent[] = [];
  for (const expected of page.tables) {
    const matches = tables.filter((t) => expected.title.test(t.title));
    if (matches.length !== 1) {
      problems.push(
        `${where}: expected exactly one table titled ${expected.title}, found ${matches.length}`,
      );
      continue;
    }
    events.push(...parseTable(matches[0]!, expected.season, page.url, where, problems));
  }
  return events;
}

function parseTable(
  table: CalendarTable,
  season: TermSeason,
  sourceUrl: string,
  where: string,
  problems: string[],
): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const context = `${where} [${table.title}]`;
  if (table.rows.length === 0) problems.push(`${context}: table has no rows`);

  for (const row of table.rows) {
    if (row.cells.length !== table.years.length) {
      problems.push(
        `${context}: row "${row.label}" has ${row.cells.length} date cells, expected ${table.years.length}`,
      );
      continue;
    }
    const rules = findRule(season, row.label);
    if (rules.length !== 1) {
      problems.push(
        rules.length === 0
          ? `${context}: no rule matches row label "${row.label}" (add one in src/ingest/rules.ts)`
          : `${context}: row "${row.label}" matches ${rules.length} rules (${rules.map((r) => r.key).join(", ")})`,
      );
      continue;
    }
    const rule = rules[0]!;

    table.years.forEach((year, i) => {
      const raw = row.cells[i]!;
      const cell = parseDateCell(raw, year);
      if (typeof cell === "string") {
        problems.push(`${context}: "${row.label}" ${year}: ${cell}`);
        return;
      }
      if (cell.kind === "none") return;

      const id = `${termId(season, year)}-${rule.key}`;
      const contradiction = checkWeekdays(cell, row.day);
      if (contradiction && !(id in ACKNOWLEDGED_SOURCE_ISSUES)) {
        problems.push(
          `${context}: "${row.label}" ${year} ("${raw}"): ${contradiction} ` +
            `If this is Loyola's error, acknowledge "${id}" in ACKNOWLEDGED_SOURCE_ISSUES.`,
        );
        return;
      }

      events.push({
        id,
        title: rule.title.replaceAll("{season}", season),
        description: row.label,
        category: rule.category,
        term: termName(season, year),
        start: cell.start,
        end: cell.end,
        ...(cell.note ? { note: cell.note } : {}),
        ...(contradiction
          ? { warning: `${contradiction} Confirm this date with Loyola.` }
          : {}),
        sourceUrl,
        ...(rule.role ? { role: rule.role } : {}),
        season,
        year,
      });
    });
  }
  return events;
}

/**
 * Parse every source page. Throws SourceFormatError listing every problem
 * if anything looks wrong.
 */
export function parseSources(pages: { page: SourcePage; html: string }[]): ParsedEvent[] {
  const problems: string[] = [];
  const events = pages.flatMap(({ page, html }) => parsePage(page, html, problems));
  if (problems.length) throw new SourceFormatError(problems);
  return events;
}
