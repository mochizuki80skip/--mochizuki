"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CalendarEntry = {
  /** ISO timestamp or YYYY-MM-DD of the entry */
  date: string;
  /** Detail page URL when this kind of entry is the only one for that day */
  href: string;
};

type Props = {
  diagnoses: CalendarEntry[];
  /** Optional daily-log entries. Different colour dot, separate href. */
  logs?: CalendarEntry[];
  /** Optional visit entries. Third colour dot. */
  visits?: CalendarEntry[];
  /**
   * When provided, days without any entry are tappable and route to
   * `${emptyDayBasePath}/${YYYY-MM-DD}` (e.g. "/me/log" → "/me/log/2026-04-27").
   * String form keeps this serialisable across the server/client boundary.
   */
  emptyDayBasePath?: string;
  initialMonth?: string;
  /**
   * When provided, day clicks call this callback with YYYY-MM-DD instead of
   * navigating. Used by parent components to render an inline detail panel.
   */
  onDayClick?: (ymd: string) => void;
  /** YYYY-MM-DD of the currently-selected day, highlighted on the grid. */
  selectedDate?: string | null;
};

const WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function ymdKey(d: Date): string {
  return `${ymKey(d)}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYm(s: string): Date {
  const [y, m] = s.split("-").map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, 1);
}

function indexBy(entries: CalendarEntry[]): Record<string, CalendarEntry[]> {
  const map: Record<string, CalendarEntry[]> = {};
  for (const e of entries) {
    const d = new Date(e.date);
    const k = ymdKey(d);
    (map[k] ||= []).push(e);
  }
  return map;
}

export default function HistoryCalendar({
  diagnoses,
  logs = [],
  visits = [],
  emptyDayBasePath,
  initialMonth,
  onDayClick,
  selectedDate,
}: Props) {
  const today = new Date();
  const todayKey = ymdKey(today);
  const [cursor, setCursor] = useState<Date>(() =>
    initialMonth
      ? parseYm(initialMonth)
      : new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const diagByDay = useMemo(() => indexBy(diagnoses), [diagnoses]);
  const logByDay = useMemo(() => indexBy(logs), [logs]);
  const visitByDay = useMemo(() => indexBy(visits), [visits]);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const monthDiagCount = diagnoses.filter((e) => {
    const d = new Date(e.date);
    return (
      d.getFullYear() === cursor.getFullYear() &&
      d.getMonth() === cursor.getMonth()
    );
  }).length;
  const monthLogCount = logs.filter((e) => {
    const d = new Date(e.date);
    return (
      d.getFullYear() === cursor.getFullYear() &&
      d.getMonth() === cursor.getMonth()
    );
  }).length;
  const monthVisitCount = visits.filter((e) => {
    const d = new Date(e.date);
    return (
      d.getFullYear() === cursor.getFullYear() &&
      d.getMonth() === cursor.getMonth()
    );
  }).length;

  function step(months: number) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + months, 1));
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white shadow-soft p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          aria-label="前の月"
          onClick={() => step(-1)}
          className="w-9 h-9 rounded-full hover:bg-ink-50 text-ink-500"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-[10px] tracking-widest text-ink-400 flex items-center justify-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
              診断 {monthDiagCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              記録 {monthLogCount}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500" />
              来院 {monthVisitCount}
            </span>
          </div>
          <div className="text-base font-black text-ink-900 tabular-nums">
            {cursor.getFullYear()}年 {cursor.getMonth() + 1}月
          </div>
        </div>
        <button
          aria-label="次の月"
          onClick={() => step(1)}
          className="w-9 h-9 rounded-full hover:bg-ink-50 text-ink-500"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] tracking-widest text-ink-400 mb-1">
        {WEEK_LABELS.map((w, i) => (
          <div
            key={w}
            className={i === 0 ? "text-rose-400" : i === 6 ? "text-sky-500" : ""}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square" />;

          const key = ymdKey(d);
          const diagEntries = diagByDay[key];
          const logEntries = logByDay[key];
          const visitEntries = visitByDay[key];
          const isToday = todayKey === key;
          const isFuture = key > todayKey;
          const isSelected = selectedDate === key;
          const dow = d.getDay();
          const baseDay = [
            "aspect-square flex flex-col items-center justify-center rounded-lg text-sm tabular-nums",
            dow === 0 ? "text-rose-500" : dow === 6 ? "text-sky-500" : "text-ink-700",
            isSelected ? "ring-2 ring-accent" : isToday ? "ring-1 ring-accent" : "",
          ].join(" ");

          const dots = (
            <div className="mt-0.5 flex gap-0.5 items-center justify-center h-2">
              {diagEntries && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
              )}
              {logEntries && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              )}
              {visitEntries && (
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500" />
              )}
            </div>
          );

          const hasEntry = !!(diagEntries || logEntries || visitEntries);

          // Click target precedence:
          //  - if onDayClick callback supplied: callback (no nav, parent
          //    renders an inline panel for the date)
          //  - else log entry exists: open log
          //  - else diagnosis: open diagnosis
          //  - else visit only: open visit's href
          //  - else empty + emptyDayBasePath + not future: navigate
          let href: string | null = null;
          if (!onDayClick) {
            if (logEntries?.[0]) href = logEntries[0].href;
            else if (diagEntries?.[0]) href = diagEntries[0].href;
            else if (visitEntries?.[0]) href = visitEntries[0].href;
            else if (emptyDayBasePath && !isFuture)
              href = `${emptyDayBasePath}/${key}`;
          }

          const cellBg = isSelected
            ? "bg-accent-100 hover:bg-accent-100"
            : hasEntry
            ? "bg-accent-50 hover:bg-accent-100"
            : href || onDayClick
            ? "hover:bg-ink-50"
            : "";

          if (onDayClick) {
            // In callback mode every (non-future) day is clickable so the
            // patient can also tap an empty day to start adding records.
            const interactive = !isFuture;
            return (
              <button
                key={i}
                type="button"
                onClick={() => interactive && onDayClick(key)}
                disabled={!interactive}
                className={`${baseDay} ${cellBg} transition`}
              >
                <span
                  className={[
                    hasEntry ? "font-bold text-ink-900" : "",
                    isFuture ? "text-ink-300" : "",
                  ].join(" ")}
                >
                  {d.getDate()}
                </span>
                {dots}
              </button>
            );
          }

          if (href) {
            return (
              <Link
                key={i}
                href={href}
                className={`${baseDay} ${cellBg} transition`}
              >
                <span className={hasEntry ? "font-bold text-ink-900" : ""}>
                  {d.getDate()}
                </span>
                {dots}
              </Link>
            );
          }

          return (
            <div key={i} className={baseDay}>
              <span className={isFuture ? "text-ink-300" : ""}>
                {d.getDate()}
              </span>
              {dots}
            </div>
          );
        })}
      </div>
    </div>
  );
}
