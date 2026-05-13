'use client';
import { setVolume } from '@/lib/training';

interface Props {
  allWorkouts: any[];
  baseDate?: Date; // 「今週」の基準日。既定: 今日
  weeks?: number;  // 表示する週数。既定: 6
}

const WEEK_LABELS = ['今週', '1週前', '2週前', '3週前', '4週前', '5週前', '6週前', '7週前'];

export function WeeklyVolumeBars({ allWorkouts, baseDate = new Date(), weeks = 6 }: Props) {
  // 「今週」= 今日を含む日曜～土曜
  const startOfWeek = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - x.getDay()); // 日曜
    return x;
  };
  const baseSunday = startOfWeek(baseDate);

  // 各週の合計負荷を算出
  const weekVolumes: number[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = new Date(baseSunday);
    start.setDate(start.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    const vol = allWorkouts
      .filter((w) => w.date >= startStr && w.date < endStr && w.type === 'strength')
      .flatMap((w) => w.sets || [])
      .reduce((s, st) => s + setVolume(st.weight, st.reps), 0);
    weekVolumes.push(vol);
  }
  const max = Math.max(...weekVolumes, 1);

  return (
    <div className="space-y-1.5">
      {weekVolumes.map((v, i) => {
        const pct = (v / max) * 100;
        const label = WEEK_LABELS[i] || `${i}週前`;
        return (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-12 text-[10px] text-ink-mute shrink-0">{label}</span>
            <div className="flex-1 h-3 bg-surface-alt rounded-full overflow-hidden relative">
              {v > 0 && (
                <div
                  className="h-full bg-brand-300 transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}
            </div>
            <span className="w-14 text-right font-bold text-ink-dim">
              {v > 0 ? `${(v / 1000).toFixed(1)}t` : '–'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
