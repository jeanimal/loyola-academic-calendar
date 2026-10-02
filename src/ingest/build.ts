/**
 * Turns parsed events into the published CalendarData: derives term
 * boundaries and carries revision info (ICS SEQUENCE / LAST-MODIFIED)
 * forward from the previously published data.
 */
import type { AcademicEvent, CalendarData, Term } from "../lib/types.ts";
import { termId, termName, type ParsedEvent } from "./parse.ts";
import { OFFICIAL_CALENDAR_URL, SOURCE_PAGES } from "./sources.ts";

export function deriveTerms(events: ParsedEvent[]): Term[] {
  const groups = new Map<string, ParsedEvent[]>();
  for (const e of events) {
    if (e.season === "J-Term") continue; // only a start date is published
    const id = termId(e.season, e.year);
    groups.set(id, [...(groups.get(id) ?? []), e]);
  }

  const terms: Term[] = [];
  for (const [id, group] of groups) {
    const { season, year } = group[0]!;
    const starts = group.filter((e) => e.role === "term-start").map((e) => e.start).sort();
    const ends = group.filter((e) => e.role === "term-end").map((e) => e.end).sort();
    const classesEnd = group.find((e) => e.role === "classes-end")?.end;
    // Missing boundaries are reported by validate(); skip the term here.
    if (!starts.length || !ends.length) continue;
    terms.push({
      id,
      name: termName(season, year),
      season,
      year,
      start: starts[0]!,
      end: ends.at(-1)!,
      ...(classesEnd ? { classesEnd } : {}),
    });
  }
  return terms.sort((a, b) => a.start.localeCompare(b.start));
}

/** The fields whose change should update subscribers' copies of an event. */
function contentKey(e: Omit<AcademicEvent, "sequence" | "lastModified">): string {
  return JSON.stringify([e.title, e.description, e.category, e.term, e.start, e.end, e.note ?? null, e.warning ?? null, e.sourceUrl]);
}

export type ChangeSummary = {
  added: AcademicEvent[];
  changed: { before: AcademicEvent; after: AcademicEvent }[];
  removed: AcademicEvent[];
};

export function buildCalendarData(
  parsed: ParsedEvent[],
  previous: CalendarData | undefined,
  now: Date,
): { data: CalendarData; changes: ChangeSummary } {
  const nowIso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const before = new Map(previous?.events.map((e) => [e.id, e]));
  const changes: ChangeSummary = { added: [], changed: [], removed: [] };

  const events: AcademicEvent[] = parsed
    .map(({ role: _role, season: _season, year: _year, ...event }) => {
      const old = before.get(event.id);
      if (!old) {
        const added = { ...event, sequence: 0, lastModified: nowIso };
        changes.added.push(added);
        return added;
      }
      if (contentKey(old) === contentKey(event)) {
        return { ...event, sequence: old.sequence, lastModified: old.lastModified };
      }
      const updated = { ...event, sequence: old.sequence + 1, lastModified: nowIso };
      changes.changed.push({ before: old, after: updated });
      return updated;
    })
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));

  const ids = new Set(events.map((e) => e.id));
  changes.removed = (previous?.events ?? []).filter((e) => !ids.has(e.id));

  const unchanged =
    previous !== undefined &&
    changes.added.length === 0 &&
    changes.changed.length === 0 &&
    changes.removed.length === 0;

  return {
    data: {
      source: {
        name: "Loyola University Chicago undergraduate academic calendar",
        officialUrl: OFFICIAL_CALENDAR_URL,
        pages: SOURCE_PAGES.map((p) => p.url),
        // Keep the old timestamp when nothing changed, so a no-op run
        // produces no diff (and no pull request).
        retrievedAt: unchanged ? previous.source.retrievedAt : nowIso,
      },
      terms: deriveTerms(parsed),
      events,
    },
    changes,
  };
}
