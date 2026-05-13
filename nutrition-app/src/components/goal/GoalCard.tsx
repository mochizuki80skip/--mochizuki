'use client';
import { Target, TrendingDown, TrendingUp, Minus, Calendar, ChevronRight } from 'lucide-react';
import type { GoalPlan, GoalProgress } from '@/lib/goal';
import { ProgressBar } from '@/components/ui/ProgressBar';

interface GoalCardProps {
  plan: GoalPlan | null;
  progress: GoalProgress | null;
  currentWeight: number | null;
  onOpen?: () => void;
  onSetup?: () => void;
}

export function GoalCard({ plan, progress, currentWeight, onOpen, onSetup }: GoalCardProps) {
  // 未設定
  if (!plan || !progress) {
    return (
      <button
        onClick={onSetup}
        className="card w-full text-left flex items-center gap-3 hover:shadow-soft transition border-2 border-dashed border-brand-200 bg-brand-50/40"
      >
        <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
          <Target className="w-5 h-5 text-brand-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-brand-700">目標を設定しよう</div>
          <div className="text-xs text-ink-dim mt-0.5">タップして目標タイプと期間を選択</div>
        </div>
        <ChevronRight className="w-5 h-5 text-brand-500 shrink-0" />
      </button>
    );
  }

  if (plan.goalType === 'log') {
    return (
      <button onClick={onOpen} className="card w-full text-left hover:shadow-soft transition">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-brand-500" />
          <div className="text-xs font-bold text-ink-dim">記録モード</div>
        </div>
        <div className="text-sm">毎日コツコツ記録を続けています</div>
      </button>
    );
  }

  const statusColor = progress.paceStatus === 'on-track' ? 'bg-emerald-500'
    : progress.paceStatus === 'ahead' ? 'bg-blue-500'
    : progress.paceStatus === 'behind' ? 'bg-amber-500'
    : progress.paceStatus === 'done' ? 'bg-brand-500'
    : 'bg-ink-mute';

  const remainingKg = plan.targetWeight - (currentWeight || plan.startWeight);
  const isLoss = plan.targetWeight < plan.startWeight;
  const PaceIcon = isLoss ? TrendingDown : TrendingUp;

  return (
    <button
      onClick={onOpen}
      className="card w-full text-left hover:shadow-soft transition bg-gradient-to-br from-white to-brand-50/30 border border-brand-100"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-ink-mute">目標</div>
            <div className="font-bold text-sm">{plan.goalLabel}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-ink-mute">あと</div>
          <div className="font-bold text-base">{progress.daysRemaining}<span className="text-[10px] font-normal text-ink-dim ml-0.5">日</span></div>
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-3 px-1">
        <div>
          <div className="text-[10px] text-ink-mute">現在</div>
          <div className="font-bold text-xl">{currentWeight ?? plan.startWeight}<span className="text-xs font-normal text-ink-dim ml-0.5">kg</span></div>
        </div>
        <div className="text-ink-mute text-sm">→</div>
        <div className="text-right">
          <div className="text-[10px] text-ink-mute">目標</div>
          <div className="font-bold text-xl text-brand-600">{plan.targetWeight}<span className="text-xs font-normal text-ink-dim ml-0.5">kg</span></div>
        </div>
      </div>

      <ProgressBar value={progress.daysElapsed} target={progress.daysTotal} color="bg-brand-500" className="mb-2" />

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusColor}`} />
          <span className="font-bold">{progress.paceMessage}</span>
        </div>
        <div className="flex items-center gap-1 text-ink-dim">
          <PaceIcon className="w-3 h-3" />
          残り {Math.abs(remainingKg).toFixed(1)}kg
        </div>
      </div>

      {progress.predictedReachDate && progress.paceStatus !== 'done' && (
        <div className="mt-3 pt-3 border-t border-brand-100 flex items-center gap-2 text-xs text-ink-dim">
          <Calendar className="w-3 h-3" />
          現ペース予測: {progress.predictedReachDate} 達成見込み
        </div>
      )}
    </button>
  );
}
