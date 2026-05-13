'use client';
import { Activity, Dumbbell, Trash2, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { useState } from 'react';
import { BODY_PARTS, setVolume, estimate1RM } from '@/lib/training';

interface Props {
  workout: any;
  expanded?: boolean;
  onDelete?: () => void;
}

export function WorkoutListItem({ workout, expanded = false, onDelete }: Props) {
  const [open, setOpen] = useState(expanded);
  const isCardio = workout.type === 'cardio';
  const totalVolume = (workout.sets || []).reduce((s: number, st: any) => s + setVolume(st.weight, st.reps), 0);
  const grouped = groupSets(workout.sets || []);

  return (
    <div className="border border-ink-line rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-3 flex items-center justify-between text-left hover:bg-surface-alt transition"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isCardio ? <Activity className="w-4 h-4 text-brand-500 shrink-0" /> : <Dumbbell className="w-4 h-4 text-brand-500 shrink-0" />}
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">
              {isCardio ? workout.cardioName || '有酸素' : `筋トレ ${grouped.length}種目`}
            </div>
            <div className="text-[10px] text-ink-mute">
              {workout.date}
              {workout.durationMin ? ` · ${workout.durationMin}分` : ''}
              {workout.kcal ? ` · ${workout.kcal}kcal` : ''}
              {!isCardio && totalVolume > 0 && ` · ${totalVolume}kg`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); if (confirm('削除しますか？')) onDelete(); }} className="text-ink-mute hover:text-rose-500 p-1.5">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-ink-mute" /> : <ChevronDown className="w-4 h-4 text-ink-mute" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-ink-line px-3 py-3 space-y-2 bg-surface-alt/40">
          {isCardio ? (
            <div className="space-y-1 text-xs text-ink-dim">
              {workout.distanceKm != null && <div>距離: {workout.distanceKm} km</div>}
              {workout.durationMin && <div>時間: {workout.durationMin} 分</div>}
              {workout.kcal && <div>消費: {workout.kcal} kcal</div>}
            </div>
          ) : (
            grouped.map((g, i) => {
              const setMaxRM = Math.max(...g.sets.map((s: any) => estimate1RM(s.weight, s.reps)));
              return (
                <div key={i} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{g.exercise}
                      <span className="text-[10px] text-ink-mute ml-1">({getBodyPartLabel(g.bodyPart)})</span>
                    </span>
                    {setMaxRM > 0 && (
                      <span className="text-[10px] flex items-center gap-0.5 text-amber-600">
                        <Trophy className="w-3 h-3" /> 1RM {setMaxRM}kg
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {g.sets.map((s: any, j: number) => (
                      <span key={j} className="text-[10px] bg-white px-2 py-0.5 rounded border border-ink-line">
                        {s.weight ?? '-'}kg × {s.reps ?? '-'}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
          {workout.memo && (
            <div className="text-[11px] text-ink-dim italic pt-2 border-t border-ink-line">
              {workout.memo}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function groupSets(sets: any[]) {
  const map = new Map<string, { exercise: string; bodyPart: string; sets: any[] }>();
  for (const s of sets) {
    const key = `${s.bodyPart}-${s.exercise}`;
    if (!map.has(key)) map.set(key, { exercise: s.exercise, bodyPart: s.bodyPart, sets: [] });
    map.get(key)!.sets.push(s);
  }
  return Array.from(map.values());
}

function getBodyPartLabel(key: string): string {
  return BODY_PARTS.find((p) => p.key === key)?.label || 'その他';
}
