'use client';
import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { ExerciseSummary } from '@/lib/strength-set-grouping';
import { estimate1RM } from '@/lib/training';
import { BODY_PARTS } from '@/lib/training';

interface Props {
  group: ExerciseSummary;
  bestRM?: number;
  onAddSet: () => void;          // 互換用（+ボタンも編集を開く）
  onEdit?: () => void;           // 種目タブ全体タップで既存セット編集
  onDeleteSet: (setId: string | undefined, workoutId: string, setIndex: number) => void;
}

const KG_TO_LBS = 2.2046;

export function ExerciseCard({ group, bestRM, onAddSet, onEdit, onDeleteSet }: Props) {
  const partLabel = BODY_PARTS.find((p) => p.key === group.bodyPart)?.label || '';
  const handleEdit = onEdit || onAddSet;

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      {/* ヘッダー：タップ全体で編集モーダルを開く */}
      <button
        onClick={handleEdit}
        className="w-full bg-brand-500 text-white px-4 py-3 flex items-center justify-between active:bg-brand-600 transition"
      >
        <div className="text-left">
          <div className="font-bold text-base">{group.exercise}</div>
          <div className="text-[10px] opacity-90">
            {partLabel} · {group.sets.length}セット · {group.totalVolume}kg
            {bestRM != null && bestRM > 0 && ` · 自己ベスト ${bestRM.toFixed(0)}kg`}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 opacity-80" />
      </button>

      <div className="p-2">
        {/* テーブルヘッダー */}
        <div className="grid grid-cols-[28px_1fr_70px_60px_30px] gap-2 px-2 py-2 text-[10px] font-bold text-ink-mute border-b border-ink-line">
          <span>セット</span>
          <span>重さ</span>
          <span className="text-center">回数</span>
          <span className="text-center">RM</span>
          <span></span>
        </div>

        {/* セット行：行タップでも編集モーダルを開く */}
        {group.sets.map((s, idx) => {
          const lbs = s.weight != null ? (s.weight * KG_TO_LBS).toFixed(1) : null;
          const rm = estimate1RM(s.weight, s.reps);
          return (
            <div
              key={s.id || `${s.workoutId}-${idx}`}
              onClick={handleEdit}
              className="grid grid-cols-[28px_1fr_70px_60px_30px] gap-2 px-2 py-2.5 items-center border-b border-ink-line/50 last:border-0 cursor-pointer hover:bg-surface-alt/50 active:bg-surface-alt transition"
            >
              <span className="text-base font-bold text-ink-mute">{idx + 1}</span>
              <span>
                <span className="text-base font-bold">{s.weight ?? '–'}</span>
                <span className="text-[10px] text-ink-mute ml-1">Kg</span>
                {lbs && <span className="text-[10px] text-ink-mute ml-2">{lbs}Lbs</span>}
              </span>
              <span className="text-center">
                <span className="text-base font-bold">{s.reps ?? '–'}</span>
                <span className="text-[10px] text-ink-mute ml-1">回</span>
              </span>
              <span className="text-center text-xs text-ink-dim font-bold">
                {rm > 0 ? `${rm.toFixed(1)}Kg` : '–'}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteSet(s.id, s.workoutId, idx); }}
                className="text-ink-mute hover:text-rose-500 p-1"
                aria-label="セット削除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}

        {/* セット追加 → 編集モーダルを開く（新セット分も追加可能） */}
        <button
          onClick={handleEdit}
          className="w-full flex items-center justify-center gap-1 py-3 mt-1 rounded-xl bg-ink-line/30 text-ink-dim hover:bg-ink-line/50 transition"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
