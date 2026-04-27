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
  /** Optional explicit period (overrides `days` when both ends are set). */
  fromDate?: string;
  toDate?: string;
  /** Override the card title. Defaults to "多かった不調 (過去 N 日)". */
  title?: string;
};

type RankItem = {
  key: string;
  label: string;
  /** Days the entry appeared. */
  count: number;
  /** Average strength (1-5) for pain rows; null for symptom rows. */
  avgStrength: number | null;
  /** Max strength for pain rows. */
  maxStrength: number | null;
  kind: "pain" | "symptom";
};

function painLabel(area: string, side: string | null): string {
  const base = BODY_PART_LABEL[area] || area;
  if (!side) return base;
  return `${PAIN_SIDE_LABEL[side as keyof typeof PAIN_SIDE_LABEL]}${base}`;
}

// Strength buckets get progressively warmer reds.
function strengthColor(strength: number): string {
  if (strength <= 1.5) return "bg-rose-200";
  if (strength <= 2.5) return "bg-rose-300";
  if (strength <= 3.5) return "bg-rose-400";
  if (strength <= 4.5) return "bg-rose-500";
  return "bg-rose-600";
}

export default function SymptomRanking({
  logs,
  days = 30,
  topN = 5,
  fromDate,
  toDate,
  title,
}: Props) {
  // Period resolution: explicit from/to wins; otherwise fall back to a
  // rolling window of `days` ending today.
  let cutoffStart: string;
  let cutoffEnd: string;
  if (fromDate && toDate) {
    cutoffStart = fromDate;
    cutoffEnd = toDate;
  } else {
    const today = new Date();
    cutoffEnd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const start = new Date();
    start.setDate(start.getDate() - days);
    cutoffStart = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  }

  const items = new Map<string, RankItem & { sumStrength: number }>();
  let totalLogs = 0;

  for (const l of logs) {
    if (l.log_date < cutoffStart) continue;
    if (l.log_date > cutoffEnd) continue;
    totalLogs++;
    // Pains
    for (const p of l.pains || []) {
      const key = `pain:${p.area}:${p.side ?? ""}`;
      const existing = items.get(key);
      if (existing) {
        existing.count++;
        existing.sumStrength += p.strength;
        if (p.strength > (existing.maxStrength ?? 0)) {
          existing.maxStrength = p.strength;
        }
      } else {
        items.set(key, {
          key,
          label: painLabel(p.area, p.side),
          count: 1,
          avgStrength: p.strength,
          maxStrength: p.strength,
          sumStrength: p.strength,
          kind: "pain",
        });
      }
    }
    // Symptoms
    for (const s of l.symptoms || []) {
      const key = `sym:${s}`;
      const existing = items.get(key);
      if (existing) {
        existing.count++;
      } else {
        items.set(key, {
          key,
          label: symptomLabelFor(s),
          count: 1,
          avgStrength: null,
          maxStrength: null,
          sumStrength: 0,
          kind: "symptom",
        });
      }
    }
  }

  // Finalise avgStrength for pain rows.
  const ranked = Array.from(items.values())
    .map((r) => ({
      ...r,
      avgStrength:
        r.kind === "pain" && r.count > 0
          ? Math.round((r.sumStrength / r.count) * 10) / 10
          : null,
    }))
    .sort((a, b) => {
      // Sort primarily by frequency, then by strength so a slightly less
      // frequent but very intense pain bubbles up over a frequent mild one.
      if (b.count !== a.count) return b.count - a.count;
      return (b.avgStrength ?? 0) - (a.avgStrength ?? 0);
    })
    .slice(0, topN);

  if (ranked.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 p-4 text-center text-xs text-ink-500">
        過去 {days} 日に記録された不調はありません
      </div>
    );
  }

  const maxCount = ranked[0].count;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft min-w-0">
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <h2 className="text-[10px] tracking-widest text-ink-400 font-bold">
          {title ?? `多かった不調 (過去 ${days} 日)`}
        </h2>
        <span className="text-[10px] text-ink-400 tabular-nums">
          {totalLogs} 日分の記録
        </span>
      </div>

      <ol className="space-y-3">
        {ranked.map((r, i) => {
          const pct = Math.round((r.count / maxCount) * 100);
          return (
            <li key={r.key}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[10px] tabular-nums text-ink-400 w-4">
                  {i + 1}.
                </span>
                <span
                  className={[
                    "inline-block w-1.5 h-1.5 rounded-full",
                    r.kind === "pain" ? "bg-rose-500" : "bg-amber-400",
                  ].join(" ")}
                />
                <span className="text-sm font-bold text-ink-900 truncate">
                  {r.label}
                </span>
                <span className="ml-auto text-[10px] text-ink-500 tabular-nums shrink-0">
                  {r.count} 日
                </span>
              </div>

              {/* Frequency bar — wider = more days */}
              <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                <div
                  className={
                    r.kind === "pain" ? "h-full bg-rose-400" : "h-full bg-amber-400"
                  }
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* For pains, show 5-step strength scale + max marker */}
              {r.kind === "pain" && r.avgStrength != null && (
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[10px] text-ink-400 tracking-widest">
                    強度
                  </span>
                  <div className="flex gap-0.5 flex-1">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const filled = n <= Math.round(r.avgStrength!);
                      const isMax =
                        r.maxStrength != null && n === r.maxStrength;
                      return (
                        <span
                          key={n}
                          className={[
                            "h-2 flex-1 rounded-sm relative",
                            filled
                              ? strengthColor(r.avgStrength!)
                              : "bg-ink-100",
                          ].join(" ")}
                        >
                          {isMax && (
                            <span
                              aria-hidden
                              className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] text-ink-400"
                            >
                              ▼
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  <span className="text-[10px] tabular-nums text-rose-700 font-bold">
                    平均 {r.avgStrength}
                    <span className="text-[9px] text-ink-400 font-normal">
                      /5
                    </span>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 pt-3 border-t border-ink-100 flex items-center gap-3 text-[10px] text-ink-400">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
          痛み（強度あり）
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
          症状
        </span>
        <span className="ml-auto">▼= 最大強度</span>
      </div>
    </div>
  );
}
