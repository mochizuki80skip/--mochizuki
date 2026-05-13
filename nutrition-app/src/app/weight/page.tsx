'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/Toast';
import { LineChart } from '@/components/ui/LineChart';
import { TrendingUp, TrendingDown, Minus, Sparkles, RefreshCw } from 'lucide-react';
import * as storage from '@/lib/storage';
import { todayStr, fmtShortDate, daysAgo } from '@/lib/utils';
import { bmi, calcTargets, sumDay } from '@/lib/nutrition';

export default function WeightPage() {
  return <WeightView />;
}

function WeightView() {
  const { toast } = useToast?.() || { toast: () => {} };
  const [profile, setProfile] = useState<any>(null);
  const [features, setFeatures] = useState({ featExercise: false, featSleep: false, featWater: false, featSteps: false });
  const [weights, setWeights] = useState<any[]>([]);
  const [date, setDate] = useState(todayStr());
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [range, setRange] = useState<7 | 30 | 90>(7);
  const [advice, setAdvice] = useState<string>('');
  const [adviceLoading, setAdviceLoading] = useState(false);

  const fetchWeeklyAdvice = async (p: any) => {
    setAdviceLoading(true);
    try {
      const t = calcTargets(p);
      const fromDate = daysAgo(7);
      const range = await storage.getMealsRange(fromDate, todayStr());
      const byDate: Record<string, any> = {};
      for (const m of range) {
        const d = byDate[m.date] = byDate[m.date] || { date: m.date, kcal: 0, protein: 0, fat: 0, carbs: 0 };
        d.kcal += m.kcal; d.protein += m.protein; d.fat += m.fat; d.carbs += m.carbs;
      }
      const recent7 = Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
      const todayMeals = await storage.getMealsByDate(todayStr());
      const todaySum = sumDay(todayMeals as any);
      const ws = (await storage.getAllWeights()).slice(-14);
      const res = await fetch('/api/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: p, targets: t, today: todaySum, recent7, weights: ws, mode: 'weekly' })
      });
      const data = await res.json();
      setAdvice(data.advice || '');
    } catch {}
    finally { setAdviceLoading(false); }
  };

  useEffect(() => {
    (async () => {
      const p = await storage.getProfile();
      if (!p || !p.sex) { window.location.href = '/onboarding'; return; }
      setProfile(p);
      setFeatures({
        featExercise: !!(p as any).featExercise,
        featSleep: !!(p as any).featSleep,
        featWater: !!(p as any).featWater,
        featSteps: !!(p as any).featSteps
      });
      setWeights(await storage.getAllWeights());
      fetchWeeklyAdvice(p);
    })();
  }, []);

  const save = async () => {
    if (!weight) return toast('体重を入力してください');
    await storage.setWeight(date, +weight, bodyFat ? +bodyFat : null);
    toast('保存しました');
    setWeight(''); setBodyFat('');
    setWeights(await storage.getAllWeights());
  };

  if (!profile) return (
    <AppShell features={features}>
      <div className="flex justify-center py-20"><span className="spinner" /></div>
    </AppShell>
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - range);
  const cutoffStr = todayStr(cutoff);
  const filtered = weights.filter((w) => w.date >= cutoffStr);
  const change = filtered.length >= 2 ? +(filtered[filtered.length - 1].weight - filtered[0].weight).toFixed(1) : null;

  const last = weights.length ? weights[weights.length - 1] : null;
  const wDiff = last && profile.targetWeight ? +(last.weight - profile.targetWeight).toFixed(1) : null;
  const initial = weights.length ? weights[0] : null;
  const totalChange = last && initial ? +(last.weight - initial.weight).toFixed(1) : null;

  return (
    <AppShell features={features}>
      <h1 className="text-xl md:text-2xl font-bold mb-4">体組成</h1>
      {initial && last && initial.date !== last.date && (
        <div className="card mb-3 bg-gradient-to-br from-brand-500 to-brand-600 text-white">
          <div className="text-xs opacity-90 mb-2">体重の推移</div>
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-[10px] opacity-80">初回</div>
              <div className="text-2xl font-bold">{initial.weight}<span className="text-sm font-normal ml-0.5">kg</span></div>
              <div className="text-[10px] opacity-80 mt-0.5">{initial.date}</div>
            </div>
            <div className="text-2xl">→</div>
            <div className="text-right">
              <div className="text-[10px] opacity-80">最新</div>
              <div className="text-3xl font-bold">{last.weight}<span className="text-sm font-normal ml-0.5">kg</span></div>
              <div className="text-[10px] opacity-80 mt-0.5">{last.date}</div>
            </div>
          </div>
          {totalChange !== null && (
            <div className="mt-3 text-sm font-bold">
              {totalChange > 0 ? '+' : ''}{totalChange} kg
            </div>
          )}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="card !p-3 text-center">
          <div className="text-[10px] text-ink-dim font-bold">現在</div>
          <div className="text-lg font-bold">{last ? last.weight : '—'}<span className="text-[10px] font-normal text-ink-mute ml-0.5">kg</span></div>
        </div>
        <div className="card !p-3 text-center">
          <div className="text-[10px] text-ink-dim font-bold">目標</div>
          <div className="text-lg font-bold">{profile.targetWeight}<span className="text-[10px] font-normal text-ink-mute ml-0.5">kg</span></div>
        </div>
        <div className="card !p-3 text-center">
          <div className="text-[10px] text-ink-dim font-bold">BMI</div>
          <div className="text-lg font-bold">{last && profile.heightCm ? bmi(last.weight, profile.heightCm) : '—'}</div>
        </div>
      </div>

      {/* Chart */}
      <div className="card mb-3">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-base">推移グラフ</h2>
          <div className="bg-surface-alt rounded-lg p-0.5 flex">
            {([7, 30, 90] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-bold rounded-md ${range === r ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-mute'}`}
              >{r === 90 ? '3ヶ月' : `${r}日`}</button>
            ))}
          </div>
        </div>
        <LineChart
          points={filtered.map((w) => ({ y: w.weight, label: fmtShortDate(w.date) }))}
          target={profile.targetWeight}
          height={200}
        />
        {change !== null && (
          <div className="mt-3 flex items-center gap-1 text-sm">
            {change > 0 ? <TrendingUp className="w-4 h-4 text-orange-500" /> : change < 0 ? <TrendingDown className="w-4 h-4 text-blue-500" /> : <Minus className="w-4 h-4 text-ink-mute" />}
            <span className={change > 0 ? 'text-orange-500' : change < 0 ? 'text-blue-500' : 'text-ink-dim'}>
              期間内 {change > 0 ? '+' : ''}{change} kg
            </span>
            {wDiff != null && (
              <span className="ml-auto text-ink-dim">
                目標まで {Math.abs(wDiff)} kg
              </span>
            )}
          </div>
        )}
      </div>

      {/* Add */}
      <div className="card mb-3">
        <h2 className="font-bold text-base mb-3">体重を記録</h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="min-w-0">
            <label className="label">日付</label>
            <input className="input w-full" style={{ minWidth: 0 }} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="min-w-0">
            <label className="label">体重 (kg)</label>
            <input className="input w-full" style={{ minWidth: 0 }} type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
        </div>
        <div className="mb-3">
          <label className="label">体脂肪率 (%) <span className="text-ink-mute font-normal">任意</span></label>
          <input className="input" type="number" inputMode="decimal" step="0.1" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
        </div>
        <button className="btn-primary w-full" onClick={save}>保存する</button>
      </div>

      {/* AI 週次レポート */}
      <div className="card mb-3 bg-gradient-to-br from-brand-50 to-white border border-brand-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="font-bold text-sm">AI 週次レポート</div>
          </div>
          <button
            onClick={() => fetchWeeklyAdvice(profile)}
            className="text-xs text-brand-600 font-bold flex items-center gap-1 hover:underline"
          >
            <RefreshCw className={`w-3 h-3 ${adviceLoading ? 'animate-spin' : ''}`} /> 更新
          </button>
        </div>
        {adviceLoading ? (
          <div className="flex items-center gap-2 text-ink-dim text-sm py-4">
            <span className="spinner" /> 分析中...
          </div>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-ink" dangerouslySetInnerHTML={{ __html: formatAdvice(advice) }} />
        )}
      </div>

      {/* History list */}
      <div className="card">
        <h2 className="font-bold text-base mb-3">履歴</h2>
        {weights.length === 0 ? (
          <div className="text-center py-6 text-ink-mute text-sm">まだ記録がありません</div>
        ) : (
          <div className="-my-2">
            {weights.slice().reverse().map((w, i) => {
              const prev = weights.slice().reverse()[i + 1];
              const diff = prev ? +(w.weight - prev.weight).toFixed(1) : null;
              return (
                <div key={w.date} className="flex items-center justify-between py-2 border-b border-ink-line last:border-0">
                  <div>
                    <div className="text-sm font-semibold">{w.date}</div>
                    {w.bodyFat != null && <div className="text-[10px] text-ink-mute">体脂肪 {w.bodyFat}%</div>}
                  </div>
                  <div className="flex items-baseline gap-2">
                    {diff !== null && diff !== 0 && (
                      <span className={`text-xs font-bold ${diff > 0 ? 'text-orange-500' : 'text-blue-500'}`}>
                        {diff > 0 ? '+' : ''}{diff}
                      </span>
                    )}
                    <span className="text-base font-bold">{w.weight}<span className="text-xs font-normal text-ink-mute ml-0.5">kg</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function formatAdvice(text: string): string {
  const escaped = text.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string));
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="text-brand-600 font-bold">$1</strong>')
                .replace(/\n/g, '<br/>');
}
