'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { BODY_PARTS, EXERCISES } from '@/lib/training';
import { Plus, ChevronRight, Activity } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  recentWorkouts: any[];
  onPick: (bodyPart: string, exercise: string) => void;
  onPickCardio: () => void;
}

export function ExerciseSelectModal({ open, onClose, recentWorkouts, onPick, onPickCardio }: Props) {
  const [customByPart, setCustomByPart] = useState<Record<string, string>>({});

  // 部位ごとの最終トレ日を計算
  const lastDayByPart = new Map<string, string>();
  // 種目ごとの最終トレ日
  const lastDayByExercise = new Map<string, string>(); // key: `${part}-${exercise}`

  for (const w of recentWorkouts) {
    if (w.type !== 'strength') continue;
    for (const s of (w.sets || [])) {
      if (!lastDayByPart.has(s.bodyPart) || lastDayByPart.get(s.bodyPart)! < w.date) {
        lastDayByPart.set(s.bodyPart, w.date);
      }
      const key = `${s.bodyPart}-${s.exercise}`;
      if (!lastDayByExercise.has(key) || lastDayByExercise.get(key)! < w.date) {
        lastDayByExercise.set(key, w.date);
      }
    }
  }

  // 部位ごとに「ユーザーが過去にやった種目」も収集（自由入力含む）
  const userExercisesByPart = new Map<string, Set<string>>();
  for (const w of recentWorkouts) {
    if (w.type !== 'strength') continue;
    for (const s of (w.sets || [])) {
      const set = userExercisesByPart.get(s.bodyPart) || new Set();
      set.add(s.exercise);
      userExercisesByPart.set(s.bodyPart, set);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="種目を選択">
      <div className="space-y-3 max-h-[70vh] overflow-y-auto -mx-1 px-1">
        {/* 有酸素 */}
        <button
          onClick={onPickCardio}
          className="w-full flex items-center justify-between p-3 bg-brand-50/50 border border-brand-200 rounded-xl hover:bg-brand-50 transition"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-brand-600" />
            <div className="text-left">
              <div className="font-bold text-sm">有酸素運動</div>
              <div className="text-[10px] text-ink-mute">ラン・バイク・水泳など</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-ink-mute" />
        </button>

        {/* 部位ごと */}
        {BODY_PARTS.map((part) => {
          const lastDay = lastDayByPart.get(part.key);
          const lastLabel = lastDay ? daysAgoLabel(lastDay) : '未記録';
          const builtin = EXERCISES[part.key] || [];
          const userSet = userExercisesByPart.get(part.key) || new Set();
          // ビルトイン + ユーザー追加分（重複除外）
          const allExercises = [...builtin, ...Array.from(userSet).filter((e) => !builtin.includes(e))];
          return (
            <div key={part.key} className="border border-ink-line rounded-xl overflow-hidden">
              <div className={`flex items-center justify-between px-3 py-2 ${part.color}`}>
                <span className="font-bold text-sm">{part.label}</span>
                <span className="text-[10px] opacity-80">{lastLabel}</span>
              </div>
              <div className="p-2 space-y-1">
                {allExercises.map((ex) => {
                  const exLast = lastDayByExercise.get(`${part.key}-${ex}`);
                  return (
                    <button
                      key={ex}
                      onClick={() => onPick(part.key, ex)}
                      className="w-full flex items-center justify-between px-2 py-2 text-left hover:bg-surface-alt rounded-lg text-sm transition"
                    >
                      <span>{ex}</span>
                      {exLast && <span className="text-[10px] text-ink-mute">{daysAgoLabel(exLast)}</span>}
                    </button>
                  );
                })}

                {/* 自由入力 */}
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder="種目を追加"
                    className="input text-xs flex-1 !py-1.5"
                    value={customByPart[part.key] || ''}
                    onChange={(e) => setCustomByPart({ ...customByPart, [part.key]: e.target.value })}
                  />
                  <button
                    onClick={() => {
                      const v = (customByPart[part.key] || '').trim();
                      if (v) {
                        onPick(part.key, v);
                        setCustomByPart({ ...customByPart, [part.key]: '' });
                      }
                    }}
                    className="btn-secondary !min-h-[36px] !px-2 text-xs shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={onClose} className="btn-secondary w-full mt-4">閉じる</button>
    </Modal>
  );
}

function daysAgoLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return '今日';
  if (diff === 1) return '昨日';
  if (diff < 7) return `${diff}日前`;
  if (diff < 30) return `${Math.floor(diff / 7)}週間前`;
  return `${Math.floor(diff / 30)}ヶ月前`;
}
