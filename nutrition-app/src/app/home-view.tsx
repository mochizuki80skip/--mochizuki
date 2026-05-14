'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { LineChart } from '@/components/ui/LineChart';
import { Sparkles, ChevronRight, TrendingDown, TrendingUp, Minus, Plus } from 'lucide-react';
import Link from 'next/link';
import { calcTargets, sumDay, sumByMeal, type Targets } from '@/lib/nutrition';
import { fmtDateJp, fmtShortDate, todayStr } from '@/lib/utils';
import * as storage from '@/lib/storage';
import { getInitialFeatures, saveFeatures } from '@/lib/features-cache';
import type { UserFeatures } from '@/components/layout/Navigation';
import { GoalCard } from '@/components/goal/GoalCard';
import { GoalSetupModal } from '@/components/goal/GoalSetupModal';
import { evaluateProgress, type GoalPlan, type GoalProgress } from '@/lib/goal';
import { predictWeight } from '@/lib/weight-prediction';
import { WeightPredictionChart } from '@/components/ui/WeightPredictionChart';

interface Props {
  user: { displayName: string; pictureUrl: string | null; isMember: boolean } | null;
  features: UserFeatures | null;
  profile: any;
  targets: Targets | null;
  meals: any[] | null;
  weights: any[] | null;
  todaySum: any;
  isTrainer: boolean;
  goalData: { plan: GoalPlan; summary: string | null } | null;
}

const DEFAULT_FEATURES: UserFeatures = { featExercise: false, featSleep: false, featWater: false, featSteps: false };

export function HomeView(props: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState(props.profile);
  const [features, setFeatures] = useState<UserFeatures>(props.features || getInitialFeatures());
  const [targets, setTargets] = useState<Targets | null>(props.targets);
  const [meals, setMeals] = useState<any[]>(props.meals || []);
  const [weights, setWeights] = useState<any[]>(props.weights || []);
  const [today, setToday] = useState(props.todaySum || { kcal: 0, protein: 0, fat: 0, carbs: 0 });
  const [advice, setAdvice] = useState<string>('食事を記録するとアドバイスが表示されます。');
  const [goalPlan, setGoalPlan] = useState<GoalPlan | null>(props.goalData?.plan || null);
  const [goalSummary, setGoalSummary] = useState<string | null>(props.goalData?.summary || null);
  const [showGoalSetup, setShowGoalSetup] = useState(false);

  useEffect(() => {
    if (props.profile) return;
    (async () => {
      const p = await storage.getProfile();
      if (!p || !p.sex) { router.replace('/onboarding'); return; }
      const t = calcTargets(p);
      const m = await storage.getMealsByDate(todayStr());
      const w = await storage.getAllWeights();
      setProfile(p);
      setTargets(t);
      setMeals(m);
      setWeights(w);
      setToday(sumDay(m as any));
      const nf = {
        featExercise: !!(p as any).featExercise,
        featSleep: !!(p as any).featSleep,
        featWater: !!(p as any).featWater,
        featSteps: !!(p as any).featSteps
      };
      setFeatures(nf);
      saveFeatures(nf);
      // ゲスト時のローカル目標プラン
      const localPlan = (p as any).goalPlanJson;
      if (localPlan && (p as any).goalApproved) {
        try {
          const parsedPlan = typeof localPlan === 'string' ? JSON.parse(localPlan) : localPlan;
          setGoalPlan(parsedPlan);
          setGoalSummary((p as any).goalPlanSummary || null);
        } catch {}
      }
    })();
  }, [props.profile, router]);

  useEffect(() => {
    if (!targets) return;
    (async () => {
      try {
        const res = await fetch('/api/advice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile, targets, today, mode: 'daily' })
        });
        if (res.ok) {
          const data = await res.json();
          setAdvice(data.advice || '');
        }
      } catch {}
    })();
  }, [targets, today, profile]);

  const onGoalApproved = async (plan: GoalPlan, summary: string) => {
    // ゲスト時はローカル保存、ログイン時はサーバー保存
    const isLoggedIn = typeof document !== 'undefined' && document.cookie.includes('om_session=');
    if (isLoggedIn) {
      await fetch('/api/goal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalType: plan.goalType,
          targetWeight: plan.targetWeight,
          goalStartedAt: plan.startedAt,
          goalDeadline: plan.deadline,
          goalPlanSummary: summary,
          goalPlanJson: plan,
          goalApproved: true
        })
      });
      // プロフィールに目標体重を反映
      await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetWeight: plan.targetWeight, goal: plan.goalType })
      });
    } else {
      await storage.saveProfile({
        ...profile,
        goal: plan.goalType,
        targetWeight: plan.targetWeight,
        ...({ goalPlanJson: plan as any, goalPlanSummary: summary, goalApproved: true } as any)
      });
    }
    setGoalPlan(plan);
    setGoalSummary(summary);
    setProfile({ ...profile, goal: plan.goalType, targetWeight: plan.targetWeight });
  };

  if (!profile || !targets) {
    return (
      <AppShell user={props.user} features={features} isTrainer={props.isTrainer}>
        <div className="flex justify-center items-center py-20"><span className="spinner" /></div>
      </AppShell>
    );
  }

  const kcalRem = targets.kcal - today.kcal;
  const byMeal = sumByMeal(meals as any);
  const lastWeight = weights.length ? weights[weights.length - 1].weight : null;

  // 目標進捗
  let goalProgress: GoalProgress | null = null;
  let actualPoints: any[] = [];
  let predictPoints: any[] = [];
  if (goalPlan) {
    goalProgress = evaluateProgress({
      plan: goalPlan,
      weights: weights.map((w) => ({ date: w.date, weight: w.weight })),
      todayStr: todayStr()
    });
    // 摂取kcal + 代謝係数から予測
    const pred = predictWeight({
      profile: {
        sex: profile.sex, age: profile.age, heightCm: profile.heightCm,
        weightKg: profile.weightKg, activity: profile.activity
      },
      goalDeadline: goalPlan.deadline,
      todayStr: todayStr(),
      weights: weights.map((w: any) => ({ date: w.date, weight: w.weight })),
      meals: [], // ホーム表示ではキャッシュ無しなのでルートからの直接ロードに任せる
      workouts: [],
      goalKcal: goalPlan.kcal
    });
    actualPoints = pred.actual;
    predictPoints = pred.predict.slice(1); // 先頭は今日と重複するので除外
  } else {
    actualPoints = weights.map((w: any) => ({ date: w.date, y: w.weight, label: fmtShortDate(w.date) }));
  }

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'おはようございます' : hour < 18 ? 'こんにちは' : 'こんばんは';

  return (
    <AppShell user={props.user} features={features} isTrainer={props.isTrainer}>
      {/* 挨拶 */}
      <div className="mb-4">
        <div className="text-xs text-ink-mute">今日 · {fmtDateJp(todayStr())}</div>
        <h1 className="text-xl md:text-2xl font-bold mt-1">{greeting}{props.user ? `、${props.user.displayName}さん` : ''}</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-3 md:gap-4 mb-4">
        {/* 🎯 セクション1: 目標 + 体重予測 + AIアドバイス（統合カード／入れ子版） */}
        <div className="card md:col-span-2 bg-gradient-to-br from-brand-50/40 to-white border border-brand-100">
          {/* 目標カード */}
          <GoalCard
            plan={goalPlan}
            progress={goalProgress}
            currentWeight={lastWeight}
            onOpen={() => setShowGoalSetup(true)}
            onSetup={() => setShowGoalSetup(true)}
          />

          {/* 体重と予測 */}
          {weights.length > 0 && (
            <div className="mt-4 pt-4 border-t border-brand-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-ink-dim">体重の推移と予測</h3>
                <Link href="/weight" className="text-[10px] text-brand-600 font-bold flex items-center hover:underline">
                  詳細 <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              {weights.length > 1 ? (
                <WeightPredictionChart actual={actualPoints} predict={predictPoints} target={goalPlan?.targetWeight} height={140} />
              ) : (
                <div className="text-center text-xs text-ink-mute py-4">記録を続けると推移と予測が表示されます</div>
              )}
            </div>
          )}

          {/* AIアドバイス：目標達成のため */}
          <div className="mt-4 pt-4 border-t border-brand-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="font-bold text-xs">
                {goalPlan ? '目標達成のためのアドバイス' : 'AIトレーナーから'}
              </div>
            </div>
            <div className="text-xs leading-relaxed whitespace-pre-wrap text-ink-dim" dangerouslySetInnerHTML={{ __html: formatAdvice(advice) }} />
          </div>
        </div>

        {/* 🍽 セクション2: 本日のカロリー + PFC + 説明（統合） */}
        <div className="card md:col-span-2 bg-gradient-to-br from-brand-500 to-brand-600 text-white">
          <div className="text-xs font-medium opacity-90">本日の摂取カロリー</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl md:text-5xl font-bold tracking-tight">{Math.round(today.kcal)}</span>
            <span className="text-sm opacity-90">/ {targets.kcal} kcal</span>
          </div>
          <div className="mt-1 text-sm opacity-95">
            {kcalRem >= 0 ? `残り ${kcalRem} kcal` : `${Math.abs(kcalRem)} kcal オーバー`}
          </div>
          <div className="mt-3 mb-4">
            <ProgressBar value={today.kcal} target={targets.kcal} color="bg-white/90" className="bg-white/20" />
          </div>

          {/* PFC バランス（同じカード内に統合） */}
          <div className="bg-white/15 rounded-xl p-3 mt-3">
            <h3 className="text-[11px] font-bold opacity-95 mb-2">PFCバランス</h3>
            <div className="space-y-2">
              <PfcRowLight letter="P" name="タンパク質" value={today.protein} target={targets.protein} />
              <PfcRowLight letter="F" name="脂質"       value={today.fat}     target={targets.fat} />
              <PfcRowLight letter="C" name="炭水化物"   value={today.carbs}   target={targets.carbs} />
            </div>
            <div className="text-[10px] opacity-90 mt-3 leading-relaxed border-t border-white/20 pt-2">
              {goalPlan ? <GoalPfcExplain plan={goalPlan} /> : 'PFCバランスを意識することで、栄養を偏らせず体組成を改善できます。'}
            </div>
          </div>
        </div>

        {/* 🍱 今日の食事 */}
        <div className="card md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold">今日の食事</h2>
            <Link href="/log" className="text-xs text-brand-600 font-bold flex items-center hover:underline">
              すべて見る <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((slot) => {
              const items = byMeal[slot];
              const kcal = items.reduce((a: number, b: any) => a + b.kcal, 0);
              const label = ({ breakfast: '朝', lunch: '昼', dinner: '夕', snack: '間食' } as const)[slot];
              return (
                <Link
                  key={slot}
                  href="/log"
                  className="block bg-surface-alt rounded-xl p-3 hover:bg-ink-line/30 transition"
                >
                  <div className="text-[10px] text-ink-mute font-bold">{label}</div>
                  <div className="text-lg font-bold mt-0.5">{kcal}<span className="text-[10px] font-normal text-ink-mute ml-0.5">kcal</span></div>
                  <div className="text-[10px] text-ink-dim mt-0.5 truncate">
                    {items.length === 0 ? '未記録' : `${items.length}件`}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* オプション機能のサマリー */}
        {features.featExercise && (
          <TrainingWidget />
        )}
        {features.featSleep && <SleepWidget />}
        {features.featWater && <WaterWidget />}
        {features.featSteps && <StepsWidget />}
      </div>

      {/* 目標設定モーダル */}
      <GoalSetupModal
        open={showGoalSetup}
        onClose={() => setShowGoalSetup(false)}
        profile={profile}
        initialPlan={goalPlan}
        onApproved={onGoalApproved}
      />
    </AppShell>
  );
}

function SleepWidget() {
  const [hours, setHours] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    (async () => {
      const s = await storage.getSleepByDate(todayStr());
      if (s) { setHours(s.hours); setDraft(String(s.hours)); }
    })();
  }, []);
  const save = async () => {
    const n = +draft;
    if (!n || isNaN(n)) return;
    await storage.setSleep({ date: todayStr(), hours: n });
    setHours(n);
    setEditing(false);
  };
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold">昨夜の睡眠</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-brand-600 font-bold">
            <Plus className="w-3 h-3 inline" /> 入力
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input type="number" step="0.5" inputMode="decimal" className="input flex-1" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="例: 7.5" autoFocus />
          <span className="text-xs text-ink-mute">時間</span>
          <button onClick={save} className="btn-primary !min-h-[40px] !px-3 text-xs">保存</button>
        </div>
      ) : (
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-bold">{hours != null ? hours.toFixed(1) : '—'}</div>
          <div className="text-xs text-ink-dim">時間</div>
          {hours != null && (
            <div className={`ml-auto text-[10px] font-bold ${
              hours < 6 ? 'text-rose-500' : hours < 7 ? 'text-amber-500' : 'text-emerald-500'
            }`}>
              {hours < 6 ? '少なめ' : hours < 7 ? 'もう少し' : '良好'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WaterWidget() {
  const [ml, setMl] = useState(0);
  const target = 2000; // 1日2L目安
  useEffect(() => {
    (async () => {
      const w = await storage.getWaterByDate(todayStr());
      if (w) setMl(w.ml);
    })();
  }, []);
  const addMl = async (delta: number) => {
    await storage.addWater(todayStr(), delta);
    const w = await storage.getWaterByDate(todayStr());
    setMl(w?.ml || 0);
  };
  const pct = Math.min(100, (ml / target) * 100);
  return (
    <div className="card">
      <h2 className="text-sm font-bold mb-2">水分摂取</h2>
      <div className="flex items-baseline gap-1 mb-2">
        <div className="text-2xl font-bold">{ml}</div>
        <div className="text-[10px] text-ink-dim">/ {target}ml</div>
      </div>
      <div className="h-2 bg-surface-alt rounded-full overflow-hidden mb-3">
        <div className="h-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button onClick={() => addMl(200)} className="py-2 text-xs font-bold bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100">+200ml</button>
        <button onClick={() => addMl(350)} className="py-2 text-xs font-bold bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100">+350ml</button>
        <button onClick={() => addMl(500)} className="py-2 text-xs font-bold bg-sky-50 text-sky-600 rounded-lg hover:bg-sky-100">+500ml</button>
      </div>
    </div>
  );
}

function StepsWidget() {
  const [todaySteps, setTodaySteps] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    (async () => {
      const s = await storage.getStepsByDate(todayStr());
      if (s) { setTodaySteps(s.count); setInput(String(s.count)); }
    })();
  }, []);
  const save = async () => {
    const n = +input;
    if (!n || isNaN(n)) return;
    await storage.setStepsCount(todayStr(), n);
    setTodaySteps(n);
    setEditing(false);
  };
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold">歩数</h2>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-brand-600 font-bold">
            <Plus className="w-3 h-3 inline" /> 入力
          </button>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input type="number" inputMode="numeric" className="input flex-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="例: 8000" autoFocus />
          <button onClick={save} className="btn-primary !min-h-[40px] !px-3 text-xs">保存</button>
        </div>
      ) : (
        <>
          <div className="text-2xl font-bold">
            {todaySteps != null ? todaySteps.toLocaleString() : '—'}
            <span className="text-xs font-normal text-ink-dim ml-1">歩</span>
          </div>
          <div className="text-[10px] text-ink-mute mt-1">
            iOSヘルスケア連携は将来対応予定（現在は手動入力）
          </div>
        </>
      )}
    </div>
  );
}

function TrainingWidget() {
  const [todayWorkouts, setTodayWorkouts] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const ws = await storage.getWorkoutsByDate(todayStr());
      setTodayWorkouts(ws);
    })();
  }, []);
  const totalKcal = todayWorkouts.reduce((s, w) => s + (w.kcal || 0), 0);
  const totalMin = todayWorkouts.reduce((s, w) => s + (w.durationMin || 0), 0);
  const volume = todayWorkouts.filter((w) => w.type === 'strength').flatMap((w) => w.sets || []).reduce((s, st) => s + (st.weight || 0) * (st.reps || 0), 0);
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold">今日のトレーニング</h2>
        <Link href="/training" className="text-xs text-brand-600 font-bold flex items-center hover:underline">
          <Plus className="w-3 h-3" /> 記録
        </Link>
      </div>
      {todayWorkouts.length === 0 ? (
        <div className="text-center py-3 text-xs text-ink-mute">未記録</div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-surface-alt rounded-lg p-2">
            <div className="text-[10px] text-ink-mute font-bold">時間</div>
            <div className="text-sm font-bold">{totalMin}<span className="text-[10px] font-normal text-ink-mute ml-0.5">分</span></div>
          </div>
          <div className="bg-surface-alt rounded-lg p-2">
            <div className="text-[10px] text-ink-mute font-bold">消費</div>
            <div className="text-sm font-bold">{totalKcal}<span className="text-[10px] font-normal text-ink-mute ml-0.5">kcal</span></div>
          </div>
          <div className="bg-surface-alt rounded-lg p-2">
            <div className="text-[10px] text-ink-mute font-bold">総負荷</div>
            <div className="text-sm font-bold">{volume}<span className="text-[10px] font-normal text-ink-mute ml-0.5">kg</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function PfcRowLight({ letter, name, value, target }: { letter: string; name: string; value: number; target: number }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline text-[11px] mb-1">
        <span className="font-bold opacity-95">{letter} {name}</span>
        <span className="opacity-90">{value.toFixed(1)} <span className="opacity-70 text-[9px]">/ {target}g</span></span>
      </div>
      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-white/90 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function GoalPfcExplain({ plan }: { plan: any }) {
  const label = plan.goalType === 'diet' ? 'ダイエット' :
                plan.goalType === 'bulk' ? 'バルクアップ' :
                plan.goalType === 'bodymake' ? '体型維持' : '記録';
  const tipMap: Record<string, string> = {
    diet: 'タンパク質を多めに摂ることで、減量中も筋肉量をキープしながら体脂肪を落としやすくなります。',
    bulk: 'タンパク質と炭水化物を充実させることで、筋肉合成を促しながら効率的に増量できます。',
    bodymake: 'バランスの取れた配分で代謝を維持しつつ、現状の体組成をキープします。',
    log: 'まずは現在のバランスを把握することで、改善ポイントが見えてきます。'
  };
  return <>「{label}」目標のためのPFC配分。{tipMap[plan.goalType] || tipMap.bodymake}</>;
}

function PfcRow({ name, letter, value, target, color, textColor }: { name: string; letter: string; value: number; target: number; color: string; textColor: string }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs mb-1">
        <span className="font-bold"><span className={textColor}>{letter}</span> {name}</span>
        <span className="text-ink-dim">{value.toFixed(1)} <span className="text-[10px]">/ {target}g</span></span>
      </div>
      <div className="h-2 bg-surface-alt rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatAdvice(text: string): string {
  const escaped = text.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string));
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="text-brand-600 font-bold">$1</strong>')
                .replace(/\n/g, '<br/>');
}
