import { REPO_URL, REPORT_ISSUE_URL } from "../config.ts";
import type { CalendarData } from "../lib/types.ts";

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
}

/** ".../schedules/spring/academic_calendar.shtml" → "Spring" */
function pageName(url: string): string {
  const season = /\/schedules\/([a-z-]+)\//i.exec(url)?.[1] ?? "calendar";
  return season[0]!.toUpperCase() + season.slice(1);
}

export function SiteFooter({ data }: { data: CalendarData }) {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <h2>About this calendar</h2>
        <p>
          This is an <strong>unofficial Loyola University Chicago academic calendar viewer</strong>,
          a community project for students and families. It is not affiliated with, sponsored by
          or endorsed by Loyola University Chicago.{" "}
          <strong>Loyola's published calendar is authoritative.</strong> Check critical dates and
          deadlines against it before relying on them.
        </p>
        <p>
          <a href={data.source.officialUrl} target="_blank" rel="noopener">
            Loyola's official academic calendar ↗
          </a>
          {" · "}Dates copied from Loyola's{" "}
          {data.source.pages.map((url, i) => (
            <span key={url}>
              {i > 0 && (i === data.source.pages.length - 1 ? " and " : ", ")}
              <a href={url} target="_blank" rel="noopener">
                {pageName(url)}
              </a>
            </span>
          ))}{" "}
          pages on <time dateTime={data.source.retrievedAt}>{formatTimestamp(data.source.retrievedAt)}</time>.
        </p>
        <p className="muted">
          These are undergraduate dates. Graduate and professional schools publish their own calendars,
          which are linked from Loyola's page.
          {!data.events.some((e) => e.term.startsWith("J-Term")) &&
            " J-Term dates aren't included because Loyola's J-Term table currently lists weekdays that don't match its dates."}
        </p>
        <p className="muted">
          Found a wrong date? <a href={REPORT_ISSUE_URL}>Report it on GitHub</a> ·{" "}
          <a href={REPO_URL}>Source code</a>
        </p>
      </div>
    </footer>
  );
}
