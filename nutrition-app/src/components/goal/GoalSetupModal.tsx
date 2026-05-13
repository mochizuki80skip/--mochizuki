'use client';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { TrendingDown, TrendingUp, Activity, Edit3, Sparkles, Calendar, Dumbbell, Apple } from 'lucide-react';
import { addDays, periodToDays, EXERCISE_KCAL_PER_SESSION } from '@/lib/goal';
import type { GoalPlan } from '@/lib/goal';
import { useToast } from '@/components/ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  profile: any;
  initialPlan?: GoalPlan | null;
  onApproved: (plan: GoalPlan, summary: string) => Promise<void>;
}

type Step = 'type' | 'period' | 'exercise' | 'review';
type GoalType = 'diet' | 'bulk' | 'bodymake' | 'log';

const TYPE_OPTIONS: { value: GoalType; label: string; sub: string; icon: any; color: string }[] = [
  { value: 'diet',     label: 'ダイエット',   sub: '体重を落としたい', icon: TrendingDown, color: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'bulk',     label: 'バルクアップ', sub: '体重・筋量UP',     icon: TrendingUp,   color: 'bg-rose-50 text-rose-600 border-rose-200' },
  { value: 'bodymake', label: '体型維持',     sub: '現状をキープ',    icon: Activity,     color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { value: 'log',      label: '記録のみ',     sub: 'まずは続けたい',  icon: Edit3,        color: 'bg-gray-50 text-gray-600 border-gray-200' }
];

const PERIOD_OPTIONS = [
  { key: '1m', label: '1ヶ月', days: 30 },
  { key: '3m', label: '3ヶ月', days: 90 },
  { key: '6m', label: '6ヶ月', days: 180 },
  { key: '12m', label: '1年', days: 365 }
];

export function GoalSetupModal({ open, onClose, profile, initialPlan, onApproved }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('type');
  const [goalType, setGoalType] = useState<GoalType>('diet');
  const [targetWeight, setTargetWeight] = useState<string>('');
  const [period, setPeriod] = useState<string>('3m');
  const [customDeadline, setCustomDeadline] = useState<string>('');
  const [useExercise, setUseExercise] = useState<boolean | null>(null);
  const [weeklyFreq, setWeeklyFreq] = useState<number>(3);
  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep('type');
    setGoalType((initialPlan?.goalType as GoalType) || 'diet');
    setTargetWeight(initialPlan?.targetWeight?.toString() || profile?.targetWeight?.toString() || '');
    setPeriod('3m');
    setCustomDeadline('');
    setUseExercise(initialPlan?.useExercise ?? null);
    setWeeklyFreq(initialPlan?.weeklyFreq || 3);
    setPlan(null);
    setSummary('');
  }, [open, initialPlan, profile]);

  const computedDeadline = () => {
    if (customDeadline) return customDeadline;
    const p = PERIOD_OPTIONS.find((x) => x.key === period);
    const d = addDays(new Date(), p?.days || periodToDays(period));
    return d.toISOString().slice(0, 10);
  };

  // 「記録のみ」は運動選択スキップ
  const isLogMode = goalType === 'log';

  const nextFromType = () => setStep('period');
  const nextFromPeriod = () => {
    if (!isLogMode && !targetWeight) {
      toast('目標体重を入力してください');
      return;
    }
    if (isLogMode) {
      // log mode skips exercise step and goes straight to review
      generatePlan(false, 0);
    } else {
      setStep('exercise');
    }
  };

  const generatePlan = async (uex: boolean, freq: number) => {
    setLoading(true);
    try {
      const deadline = computedDeadline();
      const res = await fetch('/api/goal/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalType,
          targetWeight: isLogMode ? profile.weightKg : Number(targetWeight),
          deadline,
          profile,
          useExercise: uex,
          weeklyFreq: freq
        })
      });
      if (!res.ok) { toast('プラン生成に失敗'); return; }
      const data = await res.json();
      setPlan(data.plan);
      setSummary(data.summary);
      setStep('review');
    } finally {
      setLoading(false);
    }
  };

  const goToReview = () => {
    if (useExercise === null) {
      toast('運動を組み合わせるか選択してください');
      return;
    }
    generatePlan(useExercise, weeklyFreq);
  };

  const approve = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      await onApproved(plan, summary);
      onClose();
      toast('目標を設定しました');
    } finally {
      setSaving(false);
    }
  };

  const stepIdx = isLogMode
    ? ['type', 'period', 'review'].indexOf(step)
    : ['type', 'period', 'exercise', 'review'].indexOf(step);
  const totalSteps = isLogMode ? 3 : 4;

  return (
    <Modal open={open} onClose={onClose} title="目標を設定">
      <div className="flex gap-1 mb-4">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= stepIdx ? 'bg-brand-500' : 'bg-ink-line'}`} />
        ))}
      </div>

      {step === 'type' && (
        <div className="space-y-3">
          <h3 className="font-bold text-base mb-1">何を目指しますか？</h3>
          <p className="text-xs text-ink-dim">後から変更できます。</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {TYPE_OPTIONS.map((o) => {
              const sel = goalType === o.value;
              return (
                <button
                  key={o.value}
                  onClick={() => setGoalType(o.value)}
                  className={`p-4 rounded-xl border text-left transition active:scale-[0.98] ${
                    sel ? `${o.color} border-current` : 'bg-white border-ink-line'
                  }`}
                >
                  <o.icon className={`w-5 h-5 mb-2 ${sel ? '' : 'text-ink-mute'}`} />
                  <div className={`font-bold text-sm ${sel ? '' : 'text-ink'}`}>{o.label}</div>
                  <div className={`text-[10px] mt-0.5 ${sel ? 'opacity-80' : 'text-ink-mute'}`}>{o.sub}</div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 mt-4">
            <button className="btn-secondary flex-1" onClick={onClose}>キャンセル</button>
            <button className="btn-primary flex-1" onClick={nextFromType}>次へ</button>
          </div>
        </div>
      )}

      {step === 'period' && (
        <div className="space-y-3">
          <h3 className="font-bold text-base mb-1">いつまでに？</h3>
          <p className="text-xs text-ink-dim">期間に応じて1日の目標カロリーが変わります。</p>

          {!isLogMode && (
            <div className="mt-3">
              <label className="label">目標体重 (kg)</label>
              <input
                className="input"
                type="number"
                step="0.1"
                inputMode="decimal"
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                placeholder={goalType === 'diet' ? `例: ${(profile?.weightKg - 5).toFixed(0)}` : `例: ${(profile?.weightKg + 5).toFixed(0)}`}
              />
            </div>
          )}

          <div className="mt-3">
            <label className="label">期間</label>
            <div className="grid grid-cols-4 gap-2">
              {PERIOD_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => { setPeriod(o.key); setCustomDeadline(''); }}
                  className={`py-3 rounded-xl border text-sm font-bold transition ${
                    period === o.key && !customDeadline ? 'bg-brand-50 border-brand-500 text-brand-600' : 'bg-white border-ink-line'
                  }`}
                >{o.label}</button>
              ))}
            </div>
          </div>

          <div className="mt-3">
            <label className="label">またはカスタム日付</label>
            <input
              className="input"
              type="date"
              value={customDeadline}
              onChange={(e) => setCustomDeadline(e.target.value)}
              min={addDays(new Date(), 7).toISOString().slice(0, 10)}
            />
          </div>

          <div className="bg-surface-alt rounded-lg p-3 mt-3 flex items-center gap-2 text-xs text-ink-dim">
            <Calendar className="w-4 h-4 text-brand-500" />
            <span>目標日：<span className="font-bold text-ink">{computedDeadline()}</span></span>
          </div>

          <div className="flex gap-2 mt-4">
            <button className="btn-secondary flex-1" onClick={() => setStep('type')}>戻る</button>
            <button className="btn-primary flex-1" onClick={nextFromPeriod} disabled={loading}>
              {loading ? <><span className="spinner" /> 計算中...</> : '次へ'}
            </button>
          </div>
        </div>
      )}

      {step === 'exercise' && (
        <div className="space-y-3">
          <h3 className="font-bold text-base mb-1">運動を組み合わせる？</h3>
          <p className="text-xs text-ink-dim">運動を加えると、その分多く食べられる計画になります。</p>

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => setUseExercise(false)}
              className={`p-4 rounded-xl border text-left transition active:scale-[0.98] ${
                useExercise === false ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-ink-line'
              }`}
            >
              <Apple className={`w-5 h-5 mb-2 ${useExercise === false ? '' : 'text-ink-mute'}`} />
              <div className="font-bold text-sm">食事のみ</div>
              <div className="text-[10px] text-ink-mute mt-0.5">食事管理だけで達成</div>
            </button>
            <button
              onClick={() => setUseExercise(true)}
              className={`p-4 rounded-xl border text-left transition active:scale-[0.98] ${
                useExercise === true ? 'bg-brand-50 border-brand-500 text-brand-700' : 'bg-white border-ink-line'
              }`}
            >
              <Dumbbell className={`w-5 h-5 mb-2 ${useExercise === true ? '' : 'text-ink-mute'}`} />
              <div className="font-bold text-sm">運動も加える</div>
              <div className="text-[10px] text-ink-mute mt-0.5">食事 + 週X回の運動</div>
            </button>
          </div>

          {useExercise === true && (
            <div className="mt-4">
              <label className="label">週何回 運動しますか？</label>
              <div className="grid grid-cols-7 gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    onClick={() => setWeeklyFreq(n)}
                    className={`py-3 rounded-xl border text-sm font-bold transition ${
                      weeklyFreq === n ? 'bg-brand-500 text-white border-brand-500' : 'bg-white border-ink-line text-ink-dim'
                    }`}
                  >{n}</button>
                ))}
              </div>
              <div className="mt-2 text-xs text-ink-dim flex items-center gap-1">
                <Dumbbell className="w-3 h-3" />
                1回あたり {EXERCISE_KCAL_PER_SESSION} kcal 消費 ×{weeklyFreq}回/週 = 日換算 +{Math.round((weeklyFreq * EXERCISE_KCAL_PER_SESSION) / 7)}kcal
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button className="btn-secondary flex-1" onClick={() => setStep('period')}>戻る</button>
            <button className="btn-primary flex-1" onClick={goToReview} disabled={loading || useExercise === null}>
              {loading ? <><span className="spinner" /> 計算中...</> : 'プランを見る'}
            </button>
          </div>
        </div>
      )}

      {step === 'review' && plan && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <h3 className="font-bold text-base">こんな計画でどうですか？</h3>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-br from-brand-50 to-white border border-brand-100 rounded-xl p-4">
            <div className="text-sm whitespace-pre-wrap leading-relaxed"
                 dangerouslySetInnerHTML={{ __html: formatSummary(summary) }} />
          </div>

          {/* Numbers */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="1日 摂取カロリー" value={`${plan.kcal}`} unit="kcal" highlight />
            <Stat label="週次ペース" value={`${plan.weeklyKg > 0 ? '+' : ''}${plan.weeklyKg}`} unit="kg/週" />
            <Stat label="期間" value={`${plan.weeksTotal}`} unit="週" />
            <Stat label="目標体重" value={`${plan.targetWeight}`} unit="kg" />
          </div>

          {/* Exercise summary */}
          {plan.useExercise && (
            <div className="card !p-3 bg-brand-50/50">
              <div className="flex items-center gap-2 text-sm">
                <Dumbbell className="w-4 h-4 text-brand-600" />
                <span className="font-bold text-brand-700">週{plan.weeklyFreq}回の運動を予定</span>
                <span className="text-xs text-ink-dim ml-auto">+{plan.exerciseKcalPerDay} kcal/日</span>
              </div>
            </div>
          )}

          {/* PFC */}
          <div className="card !p-3">
            <div className="text-[10px] font-bold text-ink-mute mb-2">PFC配分</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <PfcMini label="P" value={plan.protein} color="text-blue-600 bg-blue-50" />
              <PfcMini label="F" value={plan.fat} color="text-amber-600 bg-amber-50" />
              <PfcMini label="C" value={plan.carbs} color="text-rose-600 bg-rose-50" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setStep(isLogMode ? 'period' : 'exercise')}>見直す</button>
            <button className="btn-primary flex-1" onClick={approve} disabled={saving}>
              {saving ? <span className="spinner" /> : 'この計画で進める'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'bg-brand-500 text-white' : 'bg-surface-alt'}`}>
      <div className={`text-[10px] font-bold ${highlight ? 'opacity-90' : 'text-ink-mute'}`}>{label}</div>
      <div className={`text-xl font-bold ${highlight ? '' : 'text-ink'}`}>
        {value}<span className={`text-[10px] font-normal ml-1 ${highlight ? 'opacity-80' : 'text-ink-dim'}`}>{unit}</span>
      </div>
    </div>
  );
}

function PfcMini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg p-2 ${color}`}>
      <div className="text-[10px] font-bold">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value}<span className="text-[9px] font-normal opacity-60">g</span></div>
    </div>
  );
}

function formatSummary(text: string): string {
  const escaped = text.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string));
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="text-brand-600 font-bold">$1</strong>')
                .replace(/\n/g, '<br/>');
}
