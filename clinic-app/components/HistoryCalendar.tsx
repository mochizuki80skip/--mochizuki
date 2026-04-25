"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CalendarEntry = {
  /** ISO timestamp of the diagnosis */
  date: string;
  /** Detail page URL to navigate to on tap */
  href: string;
  /** Short label shown on the dot tooltip / list */
  label?: string;
};

type Props = {
  entries: CalendarEntry[];
  /** "YYYY-MM" string for the initial month (defaults to current month) */
  initialMonth?: string;
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

export default function HistoryCalendar({ entries, initialMonth }: Props) {
  const today = new Date();
  const [cursor, setCursor] = useState<Date>(() =>
    initialMonth ? parseYm(initialMonth) : new Date(today.getFullYear(), today.getMonth(), 1),
  );

  // Group entries by ymd key.
  const byDay = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    for (const e of entries) {
      const d = new Date(e.date);
      const k = ymdKey(d);
      (map[k] ||= []).push(e);
    }
    return map;
  }, [entries]);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startWeekday = monthStart.getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = monthEnd.getDate();

  // Build a 6-row x 7-col grid of cells (some leading/trailing nulls).
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const monthEntriesCount = entries.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth();
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
          <div className="text-[10px] tracking-widest text-ink-400">
            {monthEntriesCount} 件の診断履歴
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
          if (!d) {
            return <div key={i} className="aspect-square" />;
          }
          const key = ymdKey(d);
          const dayEntries = byDay[key];
          const isToday = ymdKey(today) === key;
          const dow = d.getDay();
          const dayClass = [
            "aspect-square flex flex-col items-center justify-center rounded-lg text-sm tabular-nums",
            dow === 0 ? "text-rose-500" : dow === 6 ? "text-sky-500" : "text-ink-700",
            isToday ? "ring-1 ring-accent" : "",
          ].join(" ");

          if (dayEntries && dayEntries.length > 0) {
            const target = dayEntries[0];
            return (
              <Link
                key={i}
                href={target.href}
                className={`${dayClass} bg-accent-50 hover:bg-accent-100 transition`}
              >
                <span className="font-bold text-ink-900">{d.getDate()}</span>
                <span
                  className="mt-0.5 inline-block w-1.5 h-1.5 rounded-full bg-accent"
                  aria-hidden
                />
              </Link>
            );
          }

          return (
            <div key={i} className={dayClass}>
              <span>{d.getDate()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
