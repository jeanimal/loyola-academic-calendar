import { useState } from "react";
import { FEEDS } from "../lib/feeds.ts";

/** Absolute https URL of a feed on whatever host is serving the site. */
function feedUrl(file: string): string {
  return new URL(`${import.meta.env.BASE_URL}${file}`, window.location.href).href;
}

export function Subscribe() {
  const [feedId, setFeedId] = useState(FEEDS[0]!.id);
  const [copied, setCopied] = useState(false);
  const feed = FEEDS.find((f) => f.id === feedId)!;

  const https = feedUrl(feed.file);
  const webcal = https.replace(/^https?:/, "webcal:");
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`;
  const outlook = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent(feed.calendarName)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(https);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this calendar link:", https);
    }
  };

  return (
    <section className="subscribe" aria-labelledby="subscribe-title">
      <h2 id="subscribe-title">Add these dates to your calendar</h2>
      <p className="muted">
        Subscribe once and new or changed dates show up on their own. Google Calendar can take up to a
        day to refresh.
      </p>

      <fieldset className="feed-choice">
        <legend className="sr-only">Which dates</legend>
        {FEEDS.map((f) => (
          <label key={f.id} className={f.id === feedId ? "is-selected" : undefined}>
            <input
              type="radio"
              name="feed"
              value={f.id}
              checked={f.id === feedId}
              onChange={() => setFeedId(f.id)}
            />
            <span className="feed-label">{f.label}</span>
            <span className="feed-summary">{f.summary}</span>
          </label>
        ))}
      </fieldset>

      <div className="subscribe-actions">
        <a className="button primary" href={google} target="_blank" rel="noopener">
          Google Calendar
        </a>
        <a className="button" href={webcal}>
          Apple Calendar
        </a>
        <a className="button" href={outlook} target="_blank" rel="noopener">
          Outlook
        </a>
        <a className="button" href={https} download>
          Download .ics
        </a>
        <button type="button" className="button" onClick={copy}>
          {copied ? "Copied!" : "Copy link"}
        </button>
      </div>
      <p className="feed-url">
        <code>{https}</code>
      </p>
    </section>
  );
}
