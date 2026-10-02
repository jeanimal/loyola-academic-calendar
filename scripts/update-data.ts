/**
 * Fetch Loyola's academic-calendar pages, parse and validate them, and
 * regenerate data/academic-calendar.json.
 *
 *   npm run update-data
 *   npm run update-data -- --summary changes.md   # also write a PR summary
 *
 * Exits non-zero (and writes nothing) if the pages can't be parsed safely or
 * the result fails validation. The .ics feeds are generated from the JSON at
 * build time, so they always match it.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { buildCalendarData, type ChangeSummary } from "../src/ingest/build.ts";
import { parseSources, SourceFormatError } from "../src/ingest/parse.ts";
import { ACKNOWLEDGED_SOURCE_ISSUES } from "../src/ingest/rules.ts";
import { SOURCE_PAGES } from "../src/ingest/sources.ts";
import { validate } from "../src/ingest/validate.ts";
import { formatRange } from "../src/lib/dates.ts";
import type { AcademicEvent, CalendarData } from "../src/lib/types.ts";

const DATA_PATH = new URL("../data/academic-calendar.json", import.meta.url);

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "loyola-academic-calendar (unofficial calendar viewer; https://github.com/jeanimal/loyola-academic-calendar)",
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html")) throw new Error(`GET ${url}: unexpected content-type "${type}"`);
  return res.text();
}

function describe(e: AcademicEvent): string {
  return `**${e.term}: ${e.title}** (${formatRange(e.start, e.end, true)})`;
}

function summaryMarkdown(changes: ChangeSummary): string {
  const lines: string[] = [];
  if (changes.changed.length) {
    lines.push("### Changed", "");
    for (const { before, after } of changes.changed) {
      const parts: string[] = [];
      if (before.start !== after.start || before.end !== after.end) {
        parts.push(`dates ${formatRange(before.start, before.end, true)} → ${formatRange(after.start, after.end, true)}`);
      }
      for (const field of ["title", "description", "category", "note", "warning"] as const) {
        if (before[field] !== after[field]) parts.push(`${field}: "${before[field] ?? ""}" → "${after[field] ?? ""}"`);
      }
      lines.push(`- ${describe(after)}: ${parts.join("; ") || "other fields changed"}`);
    }
    lines.push("");
  }
  if (changes.added.length) {
    lines.push("### Added", "", ...changes.added.map((e) => `- ${describe(e)}`), "");
  }
  if (changes.removed.length) {
    lines.push(
      "### Removed",
      "",
      "Removed events disappear from subscribers' calendars. Check whether Loyola dropped these on purpose (e.g. an old year rolled off the page).",
      "",
      ...changes.removed.map((e) => `- ${describe(e)}`),
      "",
    );
  }
  return lines.join("\n");
}

async function main() {
  const { values } = parseArgs({ options: { summary: { type: "string" } } });

  const pages = await Promise.all(
    SOURCE_PAGES.map(async (page) => ({ page, html: await fetchPage(page.url) })),
  );
  const parsed = parseSources(pages);

  const previous: CalendarData | undefined = existsSync(DATA_PATH)
    ? JSON.parse(readFileSync(DATA_PATH, "utf8"))
    : undefined;
  const { data, changes } = buildCalendarData(parsed, previous, new Date());

  const problems = validate(data);
  if (problems.length) {
    console.error("Generated data failed validation:\n" + problems.map((p) => `  - ${p}`).join("\n"));
    process.exit(1);
  }

  const stale = Object.keys(ACKNOWLEDGED_SOURCE_ISSUES).filter(
    (id) => !data.events.some((e) => e.id === id && e.warning),
  );
  if (stale.length) {
    console.warn(`Note: these acknowledged source issues no longer occur and can be removed: ${stale.join(", ")}`);
  }

  const total = changes.added.length + changes.changed.length + changes.removed.length;
  if (previous && total === 0) {
    console.log(`No changes. ${data.events.length} events across ${data.terms.length} terms.`);
  } else {
    writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + "\n");
    console.log(
      `Wrote ${data.events.length} events across ${data.terms.length} terms ` +
        `(${changes.added.length} added, ${changes.changed.length} changed, ${changes.removed.length} removed).`,
    );
  }
  if (values.summary) writeFileSync(values.summary, summaryMarkdown(changes));
}

main().catch((err) => {
  console.error(err instanceof SourceFormatError ? err.message : err);
  process.exit(1);
});
