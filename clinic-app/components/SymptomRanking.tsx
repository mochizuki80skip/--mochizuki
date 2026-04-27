import {
  BODY_PART_LABEL,
  PAIN_SIDE_LABEL,
  symptomLabelFor,
} from "@/lib/symptoms";
import type { DailyLog } from "@/lib/types";

type Props = {
  logs: DailyLog[];
  /** Days window for the count. Default 30. */
  days?: number;
  topN?: number;
};

type RankItem = {
  key: string;
  label: string;
  count: number;
  /** "pain" rows are tinted red; "symptom" rows use the default amber. */
  kind: "pain" | "symptom";
};

function painLabel(area: string, side: string | null): string {
  const base = BODY_PART_LABEL[area] || area;
  if (!side) return base;
  return `${PAIN_SIDE_LABEL[side as keyof typeof PAIN_SIDE_LABEL]}${base}`;
}

export default function SymptomRanking({
  logs,
  days = 30,
  topN = 5,
}: Props) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

  const counts = new Map<string, RankItem>();
  let totalLogs = 0;
  for (const l of logs) {
    if (l.log_date < cutoffKey) continue;
    totalLogs++;
    // Body part pains — count each (area, side) as a distinct entry.
    for (const p of l.pains || []) {
      const key = `pain:${p.area}:${p.side ?? ""}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, {
          key,
          label: painLabel(p.area, p.side),
          count: 1,
          kind: "pain",
        });
      }
    }
    // Neuro/autonomic symptoms.
    for (const k of l.symptoms || []) {
      const key = `sym:${k}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, {
          key,
          label: symptomLabelFor(k),
          count: 1,
          kind: "symptom",
        });
      }
    }
  }

  const ranked = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  if (ranked.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 p-4 text-center text-xs text-ink-500">
        過去 {days} 日に記録された不調はありません
      </div>
    );
  }

  const max = ranked[0].count;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft min-w-0">
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <h2 className="text-[10px] tracking-widest text-ink-400 font-bold">
          多かった不調 (過去 {days} 日)
        </h2>
        <span className="text-[10px] text-ink-400 tabular-nums">
          {totalLogs} 日分の記録
        </span>
      </div>
      <ol className="space-y-2">
        {ranked.map((r, i) => {
          const pct = Math.round((r.count / max) * 100);
          const barColor = r.kind === "pain" ? "bg-rose-400" : "bg-amber-400";
          return (
            <li key={r.key}>
              <div className="flex items-baseline gap-2 text-xs mb-1">
                <span className="text-ink-400 tabular-nums w-4">{i + 1}.</span>
                <span className="font-bold text-ink-900">{r.label}</span>
                <span className="ml-auto text-ink-500 tabular-nums">
                  {r.count} 日
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                <div
                  className={`h-full ${barColor}`}
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
