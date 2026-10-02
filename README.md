# Loyola Academic Calendar (unofficial)

**An unofficial Loyola University Chicago academic calendar viewer.**

Loyola publishes its undergraduate academic calendar as a large table. Everything you need is in there, but quick questions are hard to answer: *When are there no classes? When is Thanksgiving break? When do finals end? What's the next deadline?* This project shows the same dates as:

- a month calendar where breaks, finals, term dates and deadlines are easy to tell apart, with a list of the month's dates (the main view on phones)
- "at a glance" cards: next day off, next deadline, and week N of the semester
- **calendar feeds you can subscribe to** (Google, Apple, Outlook), so new or changed dates show up on their own

> [!IMPORTANT]
> This is a community project. It is **not affiliated with, sponsored by, or endorsed by Loyola University Chicago**. **Loyola's published calendar is authoritative:**
> <https://www.luc.edu/academics/schedules/fall/academic_calendar.shtml>
> Check critical dates and deadlines there before relying on them.

Only the **undergraduate** calendar is covered (Parkinson graduate and MSW students also follow it, per Loyola). Graduate and professional schools publish their own calendars, which are linked from Loyola's page.

---

## How it works

```
Loyola's pages (Fall / Spring / Summer)
        │  npm run update-data   (weekly GitHub Action, or by hand)
        ▼
fetch → parse (strict) → validate ──✗──> fail loudly, change nothing
        │
        ▼
data/academic-calendar.json   ← committed; reviewed in a pull request
        │  npm run build
        ▼
dist/  (static site + two .ics feeds generated from the same JSON)
```

It's a static site: no database, no server, no auth. The browser never contacts Loyola; it only reads the committed JSON that was bundled at build time.

### Project structure

```
data/academic-calendar.json   Normalized data: the single source of truth
scripts/update-data.ts        Fetch + parse + validate + write the JSON (and a change summary)
src/ingest/
  sources.ts                  Which Loyola pages and tables to read, and which to skip
  rules.ts                    Row label → stable key, short title, category
  parse.ts                    HTML → events, with strict structure and date checks
  build.ts                    Term boundaries, revision tracking (SEQUENCE / LAST-MODIFIED)
  validate.ts                 Sanity checks on the final data
  __fixtures__/               Saved copies of Loyola's pages for parser tests
src/lib/
  types.ts                    Data model
  dates.ts                    The only code that does date arithmetic
  ics.ts, feeds.ts            iCalendar generation and the two published feeds
  calendar.ts                 Month-grid layout and "at a glance" logic
src/components/               React UI
vite.config.ts                Includes a small plugin that emits the .ics feeds
.github/workflows/            CI, weekly update check, optional GitHub Pages deploy
```

### Data model

```ts
type AcademicEvent = {
  id: string;          // "fall-2026-thanksgiving-break": stable, used for ICS UIDs
  title: string;       // "Thanksgiving Break"
  description: string; // Loyola's full original wording
  category: "no-classes" | "term" | "exams" | "deadline" | "registration" | "other";
  term: string;        // "Fall 2026"
  start: string;       // "2026-11-25"
  end: string;         // "2026-11-28": INCLUSIVE last day
  note?: string;       // extra text in Loyola's cell, e.g. "updated 3/10/2025"
  warning?: string;    // source contradicts itself; shown to users
  sourceUrl: string;   // Loyola page the event came from
  sequence: number;    // bumped when the event changes (ICS SEQUENCE)
  lastModified: string;
};
```

**Dates are dates, not timestamps.** Every date is a `"YYYY-MM-DD"` string. All arithmetic lives in `src/lib/dates.ts` and uses UTC internally, so the viewer's timezone can't shift an event by a day. Tests run the date code under several timezones to check this.

**Multi-day events** store an **inclusive** `end`, which matches how Loyola writes "November 25 – 28". The ICS writer is the only place that converts to iCalendar's exclusive end date.

### Calendar feeds (ICS)

Two feeds are generated at build time from the same JSON:

| Feed | Path | Contents |
| --- | --- | --- |
| Key dates | `/loyola-academic-calendar-key-dates.ics` | Breaks, term start/end, finals |
| All dates | `/loyola-academic-calendar.ics` | Everything, including registration and deadlines |

How the feeds are written:

- **All-day events:** `DTSTART;VALUE=DATE` / `DTEND;VALUE=DATE`, with no times or timezones. `DTEND` is exclusive, so a Nov 25–28 break is written `DTSTART:20261125`, `DTEND:20261129`.
- **Stable UIDs:** `UID` is `<event id>@<feed domain>`, e.g. `fall-2026-thanksgiving-break@loyola-academic-calendar`. The id is built from the term and the rule key in `rules.ts`, never from the date or wording. If Loyola moves a date, subscribers' copy of the event is updated instead of duplicated. The two feeds use different UID domains so a person subscribed to both doesn't hit cross-calendar UID collisions.
- **Revisions:** when an event's content changes, `update-data` bumps its `sequence` and `lastModified`. These become `SEQUENCE`, `LAST-MODIFIED` and `DTSTAMP`. Unchanged data produces a byte-identical feed.
- **Provenance:** each event's description includes Loyola's original wording, an unofficial-status note, and a link to the Loyola page it came from. `TRANSP:TRANSPARENT` keeps academic dates from marking anyone as busy.
- **Formatting:** CRLF line endings, RFC 5545 text escaping, and line folding at 75 octets without splitting UTF-8 characters.

**Subscribing on a static host:** the feeds are plain files at fixed paths. The site builds the subscribe links (webcal://, Google, Outlook, download, copy) from whatever origin it's served on, so no configuration is needed. Calendar apps re-download the file periodically (Apple/Outlook honor the 12-hour refresh hint; Google refreshes on its own schedule, typically within a day).

> [!WARNING]
> **The feed URLs are a public contract.** Don't rename the `.ics` files, don't change `uidDomain` in `src/lib/feeds.ts`, and don't change existing `key`s in `src/ingest/rules.ts`. Doing so breaks or duplicates every subscriber's events. Moving hosts also changes the URL, so use a custom domain from the start if you can.

---

## Local development

Requires Node 22+.

```sh
npm install
npm run dev          # http://localhost:5173 (feeds served at /loyola-academic-calendar*.ics)
npm test             # parser, validation, ICS and date tests
npm run build        # typecheck + static build into dist/
npm run preview      # serve dist/
```

## Updating the calendar data

```sh
npm run update-data
```

This fetches Loyola's Fall, Spring and Summer pages, parses and validates them, and rewrites `data/academic-calendar.json` only if something changed. Review the diff, run `npm test`, and commit. With no changes it prints `No changes.` and touches nothing.

### How the parser detects page changes

The parser is deliberately strict. Generation **fails, and nothing is written**, if:

- a page's `<h1>` isn't what we expect, or no calendar tables are found
- an expected table (e.g. "Regular FALL Semesters") is missing, or an **unknown** calendar table appears
- a table's header row is no longer `Day` followed by year columns
- a row has the wrong number of cells
- a row label doesn't match exactly one rule in `src/ingest/rules.ts`
- a date cell can't be read (anything other than a date, a date range, `TBA` or `N/A`)
- a date's weekday contradicts the weekday Loyola printed next to it
- validation fails: too few events overall or per semester, duplicate or malformed ids, invalid dates, events longer than 14 days, dates outside the season's months or the term's year, semesters missing a start/end/last day of classes, or implausible semester lengths

The weekday cross-check has already caught one real problem (see [Known source issues](#known-source-issues)).

### When the update fails

The error lists every problem. Typical fixes:

- **New or reworded row:** add or adjust a rule in `src/ingest/rules.ts`. Reworded: change `match`, keep `key`. New: add a new `key`.
- **New table:** add it to `tables` (to parse) or `ignoredTables` (to skip) in `src/ingest/sources.ts`.
- **Loyola typo** (e.g. wrong weekday): if you've confirmed the date is right, add the event id to `ACKNOWLEDGED_SOURCE_ISSUES` in `rules.ts`. The event is then published with a visible warning asking users to confirm with Loyola. If you can't tell which part is wrong, skip it instead.
- **Layout change:** update `parse.ts`, and refresh the fixtures in `src/ingest/__fixtures__/` so the tests cover the new layout.

### Known source issues

- **J-Term (skipped).** As of 2026-10-02, Loyola's J-Term table is labeled 2027/2028 but lists "January 2 (Friday)" and "January 4 (Monday)". Those weekdays match 2026/2027, not 2027/2028, so it's unclear which year each date belongs to. The table is listed in `ignoredTables` until Loyola fixes it, and the site footer says that J-Term dates aren't included.
- **Graduation table (skipped).** It's mostly "TBA" with free-form text.

## Scheduled update workflow

`.github/workflows/update-calendar.yml` runs every Monday (and on demand from the Actions tab):

1. Runs `npm run update-data`, then the tests and a build with the new data.
2. **If dates changed**, it pushes branch `automated/calendar-update` and opens (or updates) a pull request. The PR body lists the changed, added and removed events. A person checks them against Loyola's page and merges. **Nothing reaches subscribers until a PR is merged.**
3. **If nothing changed**, it does nothing.
4. **If parsing or validation fails**, the run fails and the workflow opens an issue linking to the log (or comments on the existing one).

Repository settings it needs:

- *Settings → Actions → General → Workflow permissions*: enable **"Allow GitHub Actions to create and approve pull requests."**
- PRs opened with the built-in token don't trigger other workflows, which is why the update job runs the tests itself. To get CI checks on the PR too, close and reopen it, or swap in a fine-grained personal access token.
- GitHub disables scheduled workflows after 60 days with no repository activity; re-enable it from the Actions tab if that happens.

`ci.yml` runs tests and a build on every push and pull request.

## Deploying

The build output is `dist/`: plain static files. Relative asset paths (`base: "./"`) let the same build work at a domain root or under a sub-path.

Optional: set `SITE_URL` (e.g. `https://loyola-calendar.example.org/`) at build time to put the site's address in the feeds' `URL` property.

### Cloudflare Pages

1. Cloudflare dashboard → *Workers & Pages* → *Create* → *Pages* → connect this GitHub repository.
2. Build command `npm run build`, output directory `dist`. Set `NODE_VERSION=22` if needed.
3. Deploy. Each merge to `main` redeploys, which is how merged calendar updates reach subscribers.

`public/_headers` makes Cloudflare serve the feeds as `text/calendar`, with one-hour caching and CORS.

### GitHub Pages

1. *Settings → Pages → Build and deployment → Source*: **GitHub Actions**.
2. *Settings → Secrets and variables → Actions → Variables*: add `DEPLOY_GITHUB_PAGES` = `true` (and optionally `SITE_URL`).
3. Push to `main` or run **Deploy to GitHub Pages** manually. The site appears at `https://<user>.github.io/loyola-academic-calendar/`, and the feeds at `…/loyola-academic-calendar-key-dates.ics` and `…/loyola-academic-calendar.ics`.

The deploy workflow does nothing unless that variable is set, so Cloudflare users can ignore it.

## Reporting incorrect dates

If a date here doesn't match Loyola's official calendar, please [open an issue](https://github.com/jeanimal/loyola-academic-calendar/issues/new?template=incorrect-date.yml) with the event and a link to the Loyola page. If Loyola's own page looks wrong, contact Loyola's Office of the Registrar. This project mirrors Loyola's page and doesn't correct it.

Pull requests are welcome. Please keep the project small and static.

## Trademarks

"Loyola University Chicago" is used only to describe which calendar this project displays. The site deliberately uses no Loyola logos, colors or other brand assets.
