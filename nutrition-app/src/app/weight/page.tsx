'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/Toast';
import { LineChart } from '@/components/ui/LineChart';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import * as storage from '@/lib/storage';
import { todayStr, fmtShortDate } from '@/lib/utils';
import { bmi } from '@/lib/nutrition';

export default function WeightPage() {
  return (
    <AppShell user={null}>
      <WeightView />
    </AppShell>
  );
}

function WeightView() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [weights, setWeights] = useState<any[]>([]);
  const [date, setDate] = useState(todayStr());
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [range, setRange] = useState<7 | 30 | 90>(7);

  useEffect(() => {
    (async () => {
      const p = await storage.getProfile();
      if (!p || !p.sex) { window.location.href = '/onboarding'; return; }
      setProfile(p);
      setWeights(await storage.getAllWeights());
    })();
  }, []);

  const save = async () => {
    if (!weight) return toast('体重を入力してください');
    await storage.setWeight(date, +weight, bodyFat ? +bodyFat : null);
    toast('保存しました');
    setWeight(''); setBodyFat('');
    setWeights(await storage.getAllWeights());
  };

  if (!profile) return <div className="flex justify-center py-20"><span className="spinner" /></div>;

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
    <>
      {/* Hero summary like kaloko's "85.1 → 72.3" */}
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
          <div>
            <label className="label">日付</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label">体重 (kg)</label>
            <input className="input" type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
        </div>
        <div className="mb-3">
          <label className="label">体脂肪率 (%) <span className="text-ink-mute font-normal">任意</span></label>
          <input className="input" type="number" inputMode="decimal" step="0.1" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} />
        </div>
        <button className="btn-primary w-full" onClick={save}>保存する</button>
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
    </>
  );
}
