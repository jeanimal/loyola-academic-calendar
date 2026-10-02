import type { Category, TermSeason } from "../lib/types.ts";

/**
 * Every row label on Loyola's pages must match exactly one rule. A rule gives
 * the row a short title, a category and, most importantly, a stable `key`.
 *
 * The key becomes part of the event id ("fall-2026-<key>") and therefore of
 * the ICS UID. NEVER change an existing key: subscribers would get duplicate
 * events. If Loyola rewords a row, update `match`, not `key`.
 *
 * An unmatched label stops generation, so a human decides how a new kind of
 * row should be presented.
 */
export type Rule = {
  key: string;
  match: RegExp;
  /** "{season}" is replaced with "Fall", "Spring", ... */
  title: string;
  category: Category;
  /** Marks the dates used to compute term boundaries. */
  role?: "term-start" | "classes-end" | "term-end";
};

// Labels are normalized before matching: whitespace collapsed, curly quotes
// straightened.
const SEMESTER_RULES: Rule[] = [
  { key: "open-registration-ends", match: /^(Fall|Spring) semester open registration ends/i, title: "Open registration ends", category: "registration" },
  { key: "semester-begins", match: /^(Fall|Spring) semester begins$/i, title: "{season} semester begins", category: "term", role: "term-start" },
  { key: "late-registration-begins", match: /^Late and change of registration begins/i, title: "Late registration begins (fees apply)", category: "registration" },
  { key: "labor-day-weekend", match: /^Labor Day weekend begins/i, title: "No classes 4:15 p.m. or later (Labor Day weekend)", category: "other" },
  { key: "labor-day", match: /^Labor Day, classes do not meet$/i, title: "Labor Day", category: "no-classes" },
  { key: "mlk-day", match: /^Martin Luther King/i, title: "Martin Luther King Jr. Day", category: "no-classes" },
  { key: "last-day-to-add", match: /^Last day to add and swap class/i, title: "Last day to add or swap classes", category: "deadline" },
  { key: "classes-resume-after-labor-day", match: /^Classes resume after Labor Day$/i, title: "Classes resume", category: "term" },
  { key: "last-day-to-withdraw-without-w", match: /^Last day to withdraw without a "W" grade$/i, title: "Last day to withdraw without a W", category: "deadline" },
  { key: "last-day-credit-audit", match: /^Last day to convert from credit to audit or vice versa$/i, title: "Last day to switch credit/audit", category: "deadline" },
  { key: "last-day-pass-no-pass", match: /^Last day to request or cancel pass\/no pass option$/i, title: "Last day to request/cancel pass/no pass", category: "deadline" },
  { key: "degree-application-deadline", match: /^(Application for Degree: Last day to file|Last day to file applications with Deans' offices for degrees)/i, title: "Degree application deadline", category: "deadline" },
  { key: "incomplete-work-deadline", match: /^Last day for students to submit assignments to change an "I" mark/i, title: "Incomplete (I) coursework due", category: "deadline" },
  { key: "mid-semester-break", match: /^Mid-Semester Break: No classes$/i, title: "Mid-Semester Break", category: "no-classes" },
  { key: "classes-resume-after-mid-semester-break", match: /^Classes resume after Mid-Semester Break$/i, title: "Classes resume", category: "term" },
  { key: "j-term-registration-begins", match: /^J-Term registration begins$/i, title: "J-Term registration begins", category: "registration" },
  { key: "midterm-grades-due", match: /^Mid-Term grades due/i, title: "Mid-term grades due", category: "other" },
  { key: "last-day-to-withdraw", match: /^Last day to withdraw with a grade of "W"$/i, title: "Last day to withdraw (W grade)", category: "deadline" },
  { key: "spring-registration-begins", match: /^Spring registration begins$/i, title: "Spring registration begins", category: "registration" },
  { key: "summer-registration-begins", match: /^Summer Registration Begins$/i, title: "Summer registration begins", category: "registration" },
  { key: "fall-registration-begins", match: /^Fall Semester Undergraduate Registration begins$/i, title: "Fall registration begins", category: "registration" },
  { key: "thanksgiving-break", match: /^Thanksgiving Break: No classes/i, title: "Thanksgiving Break", category: "no-classes" },
  { key: "ash-wednesday", match: /^Ash Wed/i, title: "Ash Wednesday", category: "other" },
  { key: "spring-break", match: /^Spring Break: No classes$/i, title: "Spring Break", category: "no-classes" },
  { key: "easter-break", match: /^Easter Holiday: No classes/i, title: "Easter Break", category: "no-classes" },
  { key: "good-friday", match: /^Good Friday: No classes/i, title: "Good Friday", category: "no-classes" },
  { key: "classes-resume", match: /^Classes resume$/i, title: "Classes resume", category: "term" },
  { key: "classes-end", match: /^(Fall|Spring) semester classes end$/i, title: "Last day of classes", category: "term", role: "classes-end" },
  { key: "final-exams", match: /^Final Exams/i, title: "Final exams", category: "exams", role: "term-end" },
];

const J_TERM_RULES: Rule[] = [
  { key: "begins", match: /^J-Term begins$/i, title: "J-Term begins", category: "term" },
];

// Session name fragments as Loyola writes them.
const EARLY_AND_A = String.raw`Early Summer Session \(4-Week Session\) and Summer Session A \(First 6-Week Session\)`;
const EARLY = String.raw`Early Summer Session \(4-Week Session\)`;
const A = String.raw`(Summer )?Session A \(First 6-Week Session\)`;
const B = String.raw`Summer Session B \(Second 6-Week Session\)`;
const C = String.raw`Summer Session C \(8-Week Session\)`;
const re = (source: string) => new RegExp(`^${source}`, "i");

const SUMMER_RULES: Rule[] = [
  { key: "early-and-a-begin", match: re(`${EARLY_AND_A} begins`), title: "Early Session & Session A begin", category: "term", role: "term-start" },
  { key: "early-and-a-late-registration-ends", match: re(`${EARLY_AND_A}: Late registration ends`), title: "Late registration ends (Early & A)", category: "registration" },
  { key: "early-and-a-drop-deadline", match: re(`${EARLY_AND_A}: Last day to drop`), title: "Last day to drop without a W (Early & A)", category: "deadline" },
  { key: "early-and-a-memorial-day-makeup", match: re(`${EARLY_AND_A}: Makeup day for Memorial Day`), title: "Memorial Day make-up day (Early & A)", category: "other" },
  { key: "early-withdraw-deadline", match: re(`${EARLY}: Last day to withdraw`), title: "Last day to withdraw (Early Session)", category: "deadline" },
  { key: "early-ends", match: re(`${EARLY} ends$`), title: "Early Session ends", category: "term", role: "term-end" },
  { key: "a-credit-audit-pass-deadline", match: re(`${A}: Last day to convert`), title: "Credit/audit & pass/no pass deadline (Session A)", category: "deadline" },
  { key: "a-withdraw-deadline", match: re(`${A}: Last day to withdraw`), title: "Last day to withdraw (Session A)", category: "deadline" },
  { key: "a-ends", match: re(`${A} ends$`), title: "Session A ends", category: "term", role: "term-end" },
  { key: "b-begins", match: re(`${B} begins`), title: "Session B begins", category: "term", role: "term-start" },
  { key: "b-late-registration-ends", match: re(`${B}: Late registration ends`), title: "Late registration ends (Session B)", category: "registration" },
  { key: "b-drop-deadline", match: re(`${B}: Last day \\(midnight\\) to drop|${B}: Last day to drop`), title: "Last day to drop without a W (Session B)", category: "deadline" },
  { key: "b-credit-audit-pass-deadline", match: re(`${B}: Last day to convert`), title: "Credit/audit & pass/no pass deadline (Session B)", category: "deadline" },
  { key: "b-withdraw-deadline", match: re(`${B}: Last day to withdraw`), title: "Last day to withdraw (Session B)", category: "deadline" },
  { key: "b-ends", match: re(`${B} ends$`), title: "Session B ends", category: "term", role: "term-end" },
  { key: "c-begins", match: re(`${C} begins`), title: "Session C begins", category: "term", role: "term-start" },
  { key: "c-late-registration-ends", match: re(`${C}: Late registration ends`), title: "Late registration ends (Session C)", category: "registration" },
  { key: "c-credit-audit-pass-deadline", match: re(`${C}: Last day to convert`), title: "Credit/audit & pass/no pass deadline (Session C)", category: "deadline" },
  { key: "c-drop-deadline", match: re(`${C}: Last day to drop`), title: "Last day to drop without a W (Session C)", category: "deadline" },
  { key: "c-withdraw-deadline", match: re(`${C}: Last day to withdraw`), title: "Last day to withdraw (Session C)", category: "deadline" },
  { key: "c-ends", match: re(`${C} ends$`), title: "Session C ends", category: "term", role: "term-end" },
  { key: "memorial-day", match: /^Memorial Day ?: No classes$/i, title: "Memorial Day", category: "no-classes" },
  { key: "juneteenth", match: /^Juneteenth( celebrated)?: No classes$/i, title: "Juneteenth", category: "no-classes" },
  { key: "juneteenth-makeup", match: /^Makeup day for Juneteenth/i, title: "Juneteenth make-up day", category: "other" },
  { key: "independence-day", match: /^Independence Day ?: No classes$/i, title: "Independence Day", category: "no-classes" },
  { key: "independence-day-observed", match: /^University observed holiday for Independence Day ?: No classes$/i, title: "Independence Day (observed)", category: "no-classes" },
  { key: "independence-day-makeup", match: /^Makeup day for observed Independence Days? \(July 4\) holiday$/i, title: "Independence Day make-up day", category: "other" },
];

export const RULES: Record<TermSeason, Rule[]> = {
  Fall: SEMESTER_RULES,
  Spring: SEMESTER_RULES,
  Summer: SUMMER_RULES,
  "J-Term": J_TERM_RULES,
};

/**
 * Contradictions in Loyola's own data that a human has looked at. Without an
 * entry here, a contradiction (e.g. a weekday that doesn't match the date)
 * stops generation. With one, the event is published with a visible warning
 * telling users to confirm the date with Loyola.
 *
 * Remove entries once Loyola fixes the source.
 */
export const ACKNOWLEDGED_SOURCE_ISSUES: Record<string, string> = {
  // "fall-2027-final-exams": "Weekday typo; date confirmed with the Registrar on YYYY-MM-DD",
};
