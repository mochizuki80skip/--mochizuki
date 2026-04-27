import Link from "next/link";
import { moodFor } from "@/lib/symptoms";
import type { DailyLog } from "@/lib/types";

type Props = {
  logs: DailyLog[];
  /** Number of days to show (most recent first). Default 14. */
  days?: number;
  /** Build the URL the staff visits when tapping a cell. */
  hrefForDate: (ymd: string) => string;
};

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shortLabel(d: Date): string {
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getDate()} ${wd}`;
}

export default function SymptomHeatmap({
  logs,
  days = 14,
  hrefForDate,
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const byDate = new Map<string, DailyLog>();
  for (const l of logs) byDate.set(l.log_date, l);

  // Build day cells, oldest first so the timeline reads left-to-right.
  const cells: { date: Date; key: string; log: DailyLog | undefined }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = ymd(d);
    cells.push({ date: d, key, log: byDate.get(key) });
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft min-w-0">
      <div className="text-[10px] tracking-widest text-ink-400 mb-2 font-bold">
        最近 {days} 日の体調
      </div>
      {/* Pull the scroll viewport to the card edges so the swipe affordance
          reads cleanly on mobile, then re-add visual padding inside. */}
      <div className="-mx-4 overflow-x-auto">
        <div className="flex gap-1 px-4 pb-1">
          {cells.map(({ date, key, log }) => {
            const m = log ? moodFor(log.mood) : null;
            const symptomCount = log?.symptoms?.length ?? 0;
            const cellBg = !log
              ? "bg-ink-50 text-ink-300"
              : "bg-accent-50 hover:bg-accent-100 text-ink-900";
            return (
              <Link
                key={key}
                href={hrefForDate(key)}
                className={`shrink-0 w-11 flex flex-col items-center justify-start py-1.5 rounded-lg transition ${cellBg}`}
                aria-label={`${date.toLocaleDateString()} の記録`}
              >
                <div className="text-[10px] tracking-widest text-ink-400 whitespace-nowrap">
                  {shortLabel(date)}
                </div>
                <div className="text-xl leading-none mt-1 h-6 flex items-center">
                  {m ? m.emoji : <span className="text-ink-300 text-xs">—</span>}
                </div>
                {symptomCount > 0 && (
                  <div className="text-[9px] tabular-nums font-bold text-rose-500 mt-0.5">
                    × {symptomCount}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-ink-400">
        <span className="flex items-center gap-1">
          😄 良好 → 😣 悪い
        </span>
        <span className="flex items-center gap-1">
          <span className="text-rose-500 font-bold">×</span> 不調の項目数
        </span>
      </div>
    </div>
  );
}
