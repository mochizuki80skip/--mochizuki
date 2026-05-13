'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Ring, ProgressBar } from '@/components/ui/ProgressBar';
import { LineChart } from '@/components/ui/LineChart';
import { Sparkles, ChevronRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import Link from 'next/link';
import { calcTargets, sumDay, sumByMeal, type Targets } from '@/lib/nutrition';
import { fmtDateJp, fmtShortDate, todayStr } from '@/lib/utils';
import * as storage from '@/lib/storage';

interface Props {
  user: { displayName: string; pictureUrl: string | null; isMember: boolean } | null;
  profile: any;
  targets: Targets | null;
  meals: any[] | null;
  weights: any[] | null;
  todaySum: any;
}

export function HomeView(props: Props) {
  const router = useRouter();
  const [profile, setProfile] = useState(props.profile);
  const [targets, setTargets] = useState<Targets | null>(props.targets);
  const [meals, setMeals] = useState<any[]>(props.meals || []);
  const [weights, setWeights] = useState<any[]>(props.weights || []);
  const [today, setToday] = useState(props.todaySum || { kcal: 0, protein: 0, fat: 0, carbs: 0 });
  const [advice, setAdvice] = useState<string>('食事を記録するとアドバイスが表示されます。');

  // クライアント側でゲストモードのデータをロード
  useEffect(() => {
    if (props.profile) return; // server-side data exists
    (async () => {
      const p = await storage.getProfile();
      if (!p || !p.sex) {
        // 未オンボード → オンボーディングへ
        router.replace('/onboarding');
        return;
      }
      const t = calcTargets(p);
      const m = await storage.getMealsByDate(todayStr());
      const w = await storage.getAllWeights();
      setProfile(p);
      setTargets(t);
      setMeals(m);
      setWeights(w);
      setToday(sumDay(m as any));
    })();
  }, [props.profile, router]);

  // AIアドバイス取得
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
      <AppShell user={props.user}>
        <div className="flex justify-center items-center py-20"><span className="spinner" /></div>
      </AppShell>
    );
  }

  const kcalRem = targets.kcal - today.kcal;
  const byMeal = sumByMeal(meals as any);
  const lastWeight = weights.length ? weights[weights.length - 1] : null;
  const wDiff = lastWeight && profile.targetWeight ? +(lastWeight.weight - profile.targetWeight).toFixed(1) : null;

  return (
    <AppShell user={props.user}>
      {/* Hero: kcal balance card */}
      <div className="card mb-3 bg-gradient-to-br from-brand-500 to-brand-600 text-white">
        <div className="text-xs font-medium opacity-90">今日 · {fmtDateJp(todayStr())}</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-4xl font-bold">{Math.round(today.kcal)}</span>
          <span className="text-sm opacity-90">/ {targets.kcal} kcal</span>
        </div>
        <div className="mt-1 text-sm opacity-95">
          {kcalRem >= 0 ? `残り ${kcalRem} kcal` : `${Math.abs(kcalRem)} kcal オーバー`}
        </div>
        <div className="mt-3">
          <ProgressBar value={today.kcal} target={targets.kcal} color="bg-white/90" className="bg-white/20" />
        </div>
      </div>

      {/* PFC rings */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <PfcCell label="P" name="タンパク質" value={today.protein} target={targets.protein} color="#4C8BF5" />
        <PfcCell label="F" name="脂質" value={today.fat} target={targets.fat} color="#F59E0B" />
        <PfcCell label="C" name="炭水化物" value={today.carbs} target={targets.carbs} color="#EF4444" />
      </div>

      {/* AI advice */}
      <div className="card mb-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-full bg-brand-50 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-brand-500" />
          </div>
          <div className="font-bold text-sm">AIトレーナーから</div>
        </div>
        <div className="text-sm leading-relaxed whitespace-pre-wrap text-ink-dim" dangerouslySetInnerHTML={{ __html: formatAdvice(advice) }} />
        <Link href="/advice" className="mt-3 flex items-center text-brand-600 text-sm font-semibold">
          詳しいアドバイスを見る <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Today's meals */}
      <div className="card mb-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-bold text-base">今日の食事</h2>
          <Link href="/log" className="text-xs text-brand-600 font-semibold flex items-center">
            すべて見る <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((slot) => {
          const items = byMeal[slot];
          const kcal = items.reduce((a: number, b: any) => a + b.kcal, 0);
          const label = ({ breakfast: '朝', lunch: '昼', dinner: '夕', snack: '間食' } as const)[slot];
          if (items.length === 0) return null;
          return (
            <div key={slot} className="py-2 border-b border-ink-line last:border-0">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold">{label}</span>
                <span className="text-xs text-ink-dim">{kcal} kcal</span>
              </div>
              <div className="text-xs text-ink-dim mt-0.5">
                {items.map((i: any) => i.name).join(' · ')}
              </div>
            </div>
          );
        })}
        {meals.length === 0 && (
          <div className="text-center py-6 text-ink-mute text-sm">
            まだ記録がありません
          </div>
        )}
      </div>

      {/* Weight */}
      <Link href="/weight" className="block">
        <div className="card mb-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-base">体重</h2>
            <ChevronRight className="w-4 h-4 text-ink-mute" />
          </div>
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="text-3xl font-bold">{lastWeight ? lastWeight.weight : '—'}<span className="text-sm font-normal text-ink-dim ml-1">kg</span></div>
              {wDiff != null && (
                <div className={`text-xs mt-1 flex items-center gap-1 ${wDiff > 0 ? 'text-orange-500' : wDiff < 0 ? 'text-blue-500' : 'text-green-500'}`}>
                  {wDiff > 0 ? <TrendingUp className="w-3 h-3" /> : wDiff < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  目標まで {Math.abs(wDiff)} kg
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-ink-mute">目標</div>
              <div className="text-base font-semibold">{profile.targetWeight} kg</div>
            </div>
          </div>
          {weights.length > 1 && (
            <LineChart
              points={weights.map((w: any) => ({ y: w.weight, label: fmtShortDate(w.date) }))}
              target={profile.targetWeight}
              height={140}
            />
          )}
        </div>
      </Link>
    </AppShell>
  );
}

function PfcCell({ label, name, value, target, color }: { label: string; name: string; value: number; target: number; color: string }) {
  return (
    <div className="card !p-3 text-center">
      <div className="flex justify-center mb-1">
        <Ring value={value} target={target} size={56} color={color} />
      </div>
      <div className="text-[10px] font-bold text-ink-dim">{label} · {name}</div>
      <div className="text-sm font-bold mt-0.5">{value.toFixed(1)}<span className="text-[10px] text-ink-mute font-normal">/{target}g</span></div>
    </div>
  );
}

function formatAdvice(text: string): string {
  const escaped = text.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string));
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="text-brand-600 font-bold">$1</strong>')
                .replace(/\n/g, '<br/>');
}
