import { useEffect, useMemo, useState } from "react";
import rawData from "../data/academic-calendar.json";
import { AtAGlance } from "./components/AtAGlance.tsx";
import { CategoryFilter } from "./components/CategoryFilter.tsx";
import { EventDialog } from "./components/EventDialog.tsx";
import { MonthAgenda } from "./components/MonthAgenda.tsx";
import { MonthGrid } from "./components/MonthGrid.tsx";
import { SiteFooter } from "./components/SiteFooter.tsx";
import { Subscribe } from "./components/Subscribe.tsx";
import { CATEGORIES } from "./lib/categories.ts";
import { clampMonth, monthFromHash, monthRange, monthToHash, overlaps } from "./lib/calendar.ts";
import { addDays, addMonths, formatMonthYear, startOfMonth, todayLocal } from "./lib/dates.ts";
import type { AcademicEvent, CalendarData, Category } from "./lib/types.ts";

const data = rawData as CalendarData;
const range = monthRange(data.events);
const FILTER_KEY = "lac:hidden-categories";

function initialMonth(today: string): string {
  return clampMonth(monthFromHash(window.location.hash) ?? startOfMonth(today), range);
}

function loadHidden(): Set<Category> {
  try {
    const saved = JSON.parse(localStorage.getItem(FILTER_KEY) ?? "[]");
    return new Set(Array.isArray(saved) ? saved.filter((c) => CATEGORIES.some((k) => k.id === c)) : []);
  } catch {
    return new Set();
  }
}

export function App() {
  const today = useMemo(() => todayLocal(), []);
  const [month, setMonth] = useState(() => initialMonth(today));
  const [hidden, setHidden] = useState<Set<Category>>(loadHidden);
  const [selected, setSelected] = useState<AcademicEvent | null>(null);

  useEffect(() => {
    history.replaceState(null, "", monthToHash(month));
  }, [month]);

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify([...hidden]));
  }, [hidden]);

  useEffect(() => {
    const onHash = () => {
      const m = monthFromHash(window.location.hash);
      if (m) setMonth(clampMonth(m, range));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const visibleEvents = useMemo(
    () => data.events.filter((e) => !hidden.has(e.category)),
    [hidden],
  );
  const monthEvents = useMemo(() => {
    const last = addDays(addMonths(month, 1), -1);
    return visibleEvents.filter((e) => overlaps(e, month, last));
  }, [visibleEvents, month]);

  const go = (delta: number) => setMonth((m) => clampMonth(addMonths(m, delta), range));
  const thisMonth = clampMonth(startOfMonth(today), range);

  const toggle = (category: Category) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  return (
    <>
      <a className="skip-link" href="#calendar">
        Skip to calendar
      </a>
      <div className="notice" role="note">
        <strong>Unofficial.</strong> Not affiliated with Loyola University Chicago.{" "}
        <a href={data.source.officialUrl} target="_blank" rel="noopener">
          Check important dates on Loyola's official calendar
        </a>
      </div>

      <header className="site-header">
        <div className="wrap">
          <h1>Loyola Academic Calendar</h1>
          <p className="tagline">
            An unofficial, easier-to-read view of Loyola University Chicago's undergraduate
            academic calendar.
          </p>
        </div>
      </header>

      <main className="wrap">
        <AtAGlance data={data} today={today} onSelect={setSelected} />

        <section id="calendar" className="calendar-card" aria-labelledby="month-title">
          <div className="toolbar">
            <div className="month-nav">
              <button
                type="button"
                className="icon-button"
                onClick={() => go(-1)}
                disabled={month <= range.first}
                aria-label="Previous month"
              >
                ‹
              </button>
              <h2 id="month-title" aria-live="polite">
                {formatMonthYear(month)}
              </h2>
              <button
                type="button"
                className="icon-button"
                onClick={() => go(1)}
                disabled={month >= range.last}
                aria-label="Next month"
              >
                ›
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setMonth(thisMonth)}
                disabled={month === thisMonth}
              >
                Today
              </button>
            </div>
            <CategoryFilter hidden={hidden} onToggle={toggle} />
          </div>

          <MonthGrid month={month} events={visibleEvents} today={today} onSelect={setSelected} />
          <MonthAgenda month={month} events={monthEvents} today={today} onSelect={setSelected} />
        </section>

        <Subscribe />
      </main>

      <SiteFooter data={data} />

      <EventDialog event={selected} onClose={() => setSelected(null)} />
    </>
  );
}
