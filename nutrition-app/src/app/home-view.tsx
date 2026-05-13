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
import type { UserFeatures } from '@/components/layout/Navigation';

interface Props {
  user: { displayName: string; pictureUrl: string | null; isMember: boolean } | null;
  features: UserFeatures | null;
  profile: any;
  targets: Targets | null;
  meals: any[] | null;
  weights: any[] | null;
  todaySum: any;
  isTrainer: boolean;
}

const DEFAULT_FEATURES: UserFeatures = { featExercise: false, featSleep: false, featWater: false, featSteps: false };

export function HomeView(props: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState(props.profile);
  const [features, setFeatures] = useState<UserFeatures>(props.features || DEFAULT_FEATURES);
  const [targets, setTargets] = useState<Targets | null>(props.targets);
  const [meals, setMeals] = useState<any[]>(props.meals || []);
  const [weights, setWeights] = useState<any[]>(props.weights || []);
  const [today, setToday] = useState(props.todaySum || { kcal: 0, protein: 0, fat: 0, carbs: 0 });
  const [advice, setAdvice] = useState<string>('食事を記録するとアドバイスが表示されます。');

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
      // ローカルではプロフィールから feat* フラグを読み取り
      setFeatures({
        featExercise: !!(p as any).featExercise,
        featSleep: !!(p as any).featSleep,
        featWater: !!(p as any).featWater,
        featSteps: !!(p as any).featSteps
      });
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

  if (!profile || !targets) {
    return (
      <AppShell user={props.user} features={features} isTrainer={props.isTrainer}>
        <div className="flex justify-center items-center py-20"><span className="spinner" /></div>
      </AppShell>
    );
  }

  const kcalRem = targets.kcal - today.kcal;
  const byMeal = sumByMeal(meals as any);
  const lastWeight = weights.length ? weights[weights.length - 1] : null;
  const wDiff = lastWeight && profile.targetWeight ? +(lastWeight.weight - profile.targetWeight).toFixed(1) : null;
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
        {/* カロリー収支カード */}
        <div className="card bg-gradient-to-br from-brand-500 to-brand-600 text-white md:col-span-2">
          <div className="text-xs font-medium opacity-90">本日の摂取カロリー</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-4xl md:text-5xl font-bold tracking-tight">{Math.round(today.kcal)}</span>
            <span className="text-sm opacity-90">/ {targets.kcal} kcal</span>
          </div>
          <div className="mt-1 text-sm opacity-95">
            {kcalRem >= 0 ? `残り ${kcalRem} kcal` : `${Math.abs(kcalRem)} kcal オーバー`}
          </div>
          <div className="mt-3">
            <ProgressBar value={today.kcal} target={targets.kcal} color="bg-white/90" className="bg-white/20" />
          </div>
        </div>

        {/* PFCバー（コンパクト横長） */}
        <div className="card md:col-span-2">
          <h2 className="text-sm font-bold mb-3">PFCバランス</h2>
          <div className="space-y-3">
            <PfcRow name="タンパク質" letter="P" value={today.protein} target={targets.protein} color="bg-blue-500" textColor="text-blue-600" />
            <PfcRow name="脂質"       letter="F" value={today.fat}     target={targets.fat}     color="bg-amber-500" textColor="text-amber-600" />
            <PfcRow name="炭水化物"   letter="C" value={today.carbs}   target={targets.carbs}   color="bg-rose-500" textColor="text-rose-600" />
          </div>
        </div>

        {/* 今日の食事 */}
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
                  className="block bg-surface-alt rounded-xl p-3 hover:bg-ink-line transition"
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

        {/* 体組成サマリー */}
        <div className="card md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold">体組成</h2>
            <Link href="/weight" className="text-xs text-brand-600 font-bold flex items-center hover:underline">
              詳細 <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="flex items-baseline justify-between mb-3 gap-4">
            <div>
              <div className="text-[10px] text-ink-mute font-bold">現在</div>
              <div className="text-2xl md:text-3xl font-bold">{lastWeight ? lastWeight.weight : '—'}<span className="text-sm font-normal text-ink-dim ml-1">kg</span></div>
              {wDiff != null && wDiff !== 0 && (
                <div className={`text-[11px] mt-1 flex items-center gap-1 ${wDiff > 0 ? 'text-orange-500' : 'text-blue-500'}`}>
                  {wDiff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  目標まで {Math.abs(wDiff)} kg
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] text-ink-mute font-bold">目標</div>
              <div className="text-base md:text-lg font-semibold">{profile.targetWeight} kg</div>
            </div>
          </div>
          {weights.length > 1 ? (
            <LineChart
              points={weights.map((w: any) => ({ y: w.weight, label: fmtShortDate(w.date) }))}
              target={profile.targetWeight}
              height={120}
            />
          ) : (
            <div className="text-center text-xs text-ink-mute py-4">記録を続けると推移グラフが表示されます</div>
          )}
        </div>

        {/* オプション機能のサマリー */}
        {features.featExercise && (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold">今日のトレーニング</h2>
              <Link href="/training" className="text-xs text-brand-600 font-bold flex items-center hover:underline">
                <Plus className="w-3 h-3" /> 記録
              </Link>
            </div>
            <div className="text-center py-3 text-xs text-ink-mute">トレーニングはPhase 2で実装します</div>
          </div>
        )}
        {features.featSleep && (
          <div className="card">
            <h2 className="text-sm font-bold mb-2">昨夜の睡眠</h2>
            <div className="text-center py-3 text-xs text-ink-mute">睡眠機能はPhase 3で実装します</div>
          </div>
        )}
        {features.featWater && (
          <div className="card">
            <h2 className="text-sm font-bold mb-2">水分摂取</h2>
            <div className="text-center py-3 text-xs text-ink-mute">水分機能はPhase 3で実装します</div>
          </div>
        )}
        {features.featSteps && (
          <div className="card">
            <h2 className="text-sm font-bold mb-2">歩数</h2>
            <div className="text-center py-3 text-xs text-ink-mute">歩数機能はPhase 3で実装します</div>
          </div>
        )}

        {/* AIアドバイス */}
        <div className="card md:col-span-2 bg-gradient-to-br from-brand-50 to-white border border-brand-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="font-bold text-sm">AIトレーナーから</div>
          </div>
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-ink" dangerouslySetInnerHTML={{ __html: formatAdvice(advice) }} />
          <Link href="/advice" className="mt-3 inline-flex items-center text-brand-600 text-xs font-bold hover:underline">
            詳しいアドバイスを見る <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </AppShell>
  );
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
