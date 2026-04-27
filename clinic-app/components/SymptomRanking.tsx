import { SYMPTOM_LABEL } from "@/lib/symptoms";
import type { DailyLog } from "@/lib/types";

type Props = {
  logs: DailyLog[];
  /** Days window for the count. Default 30. */
  days?: number;
  topN?: number;
};

export default function SymptomRanking({
  logs,
  days = 30,
  topN = 5,
}: Props) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

  const counts: Record<string, number> = {};
  let totalLogs = 0;
  for (const l of logs) {
    if (l.log_date < cutoffKey) continue;
    totalLogs++;
    for (const k of l.symptoms) {
      counts[k] = (counts[k] || 0) + 1;
    }
  }

  const ranked = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);

  if (ranked.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 p-4 text-center text-xs text-ink-500">
        過去 {days} 日に記録された不調はありません
      </div>
    );
  }

  const max = ranked[0][1];

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[10px] tracking-widest text-ink-400 font-bold">
          多かった不調 (過去 {days} 日)
        </h2>
        <span className="text-[10px] text-ink-400 tabular-nums">
          {totalLogs} 日分の記録
        </span>
      </div>
      <ol className="space-y-2">
        {ranked.map(([key, count], i) => {
          const pct = Math.round((count / max) * 100);
          return (
            <li key={key}>
              <div className="flex items-baseline gap-2 text-xs mb-1">
                <span className="text-ink-400 tabular-nums w-4">{i + 1}.</span>
                <span className="font-bold text-ink-900">
                  {SYMPTOM_LABEL[key] || key}
                </span>
                <span className="ml-auto text-ink-500 tabular-nums">
                  {count} 日
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                <div
                  className="h-full bg-rose-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
