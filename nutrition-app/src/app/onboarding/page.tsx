'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { calcTargets, GOAL_PRESETS } from '@/lib/nutrition';
import * as storage from '@/lib/storage';
import { todayStr } from '@/lib/utils';

export default function OnboardingPage() {
  return (
    <ToastProvider>
      <Onboarding />
    </ToastProvider>
  );
}

function Onboarding() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    sex: '' as '' | 'male' | 'female',
    age: '',
    heightCm: '',
    weightKg: '',
    targetWeight: '',
    activity: '' as '' | 'low' | 'mid' | 'high',
    goal: '' as '' | 'diet' | 'bodymake' | 'bulk',
    memberCode: ''
  });

  // 既にオンボード済みならホームへ
  useEffect(() => {
    (async () => {
      const p = await storage.getProfile();
      if (p && p.sex && p.onboardedAt) router.replace('/');
    })();
  }, [router]);

  const set = (k: string, v: string) => setData((d) => ({ ...d, [k]: v }));

  const validate0 = (): string | null => {
    if (!data.sex) return '性別を選択してください';
    const a = +data.age, h = +data.heightCm, w = +data.weightKg, tw = +data.targetWeight;
    if (!a || a < 14 || a > 90) return '年齢を正しく入力してください';
    if (!h || h < 120 || h > 220) return '身長を正しく入力してください';
    if (!w || w < 30 || w > 200) return '体重を正しく入力してください';
    if (!tw || tw < 30 || tw > 200) return '目標体重を入力してください';
    return null;
  };
  const validate1 = (): string | null => {
    if (!data.activity) return '活動量を選択してください';
    if (!data.goal) return '目標を選択してください';
    return null;
  };

  const finish = async () => {
    const profile = {
      sex: data.sex,
      age: +data.age,
      heightCm: +data.heightCm,
      weightKg: +data.weightKg,
      targetWeight: +data.targetWeight,
      activity: data.activity,
      goal: data.goal,
      onboardedAt: new Date().toISOString(),
      memberCode: data.memberCode.trim() || undefined
    };
    await storage.saveProfile(profile);
    await storage.setWeight(todayStr(), +data.weightKg, null);
    router.replace('/');
  };

  const targets = data.sex && data.age && data.heightCm && data.weightKg
    ? calcTargets({ sex: data.sex, age: +data.age, heightCm: +data.heightCm, weightKg: +data.weightKg, activity: data.activity || 'mid', goal: data.goal || 'bodymake' })
    : null;

  return (
    <div className="min-h-screen bg-white" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="container-app py-6">
        <div className="flex items-center justify-between mb-6">
          <BrandMark />
          <span className="text-xs text-ink-mute">ステップ {step + 1} / 3</span>
        </div>

        <div className="flex gap-1.5 mb-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full ${i <= step ? 'bg-brand-500' : 'bg-ink-line'}`} />
          ))}
        </div>

        {step === 0 && (
          <div className="animate-fadeUp">
            <h1 className="text-2xl font-bold mb-1">はじめまして</h1>
            <p className="text-ink-dim text-sm mb-6">あなたの目標カロリーを計算するために、基本情報を教えてください。</p>

            <div className="mb-5">
              <label className="label">性別</label>
              <div className="flex gap-2">
                {[
                  { k: 'male', label: '男性' },
                  { k: 'female', label: '女性' }
                ].map((o) => (
                  <button
                    key={o.k}
                    onClick={() => set('sex', o.k)}
                    className={`chip flex-1 ${data.sex === o.k ? 'chip-active' : ''}`}
                  >{o.label}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="label">年齢</label>
                <input className="input" type="number" inputMode="numeric" value={data.age} onChange={(e) => set('age', e.target.value)} placeholder="30" />
              </div>
              <div>
                <label className="label">身長 (cm)</label>
                <input className="input" type="number" inputMode="decimal" step="0.1" value={data.heightCm} onChange={(e) => set('heightCm', e.target.value)} placeholder="170" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="label">現在の体重 (kg)</label>
                <input className="input" type="number" inputMode="decimal" step="0.1" value={data.weightKg} onChange={(e) => set('weightKg', e.target.value)} placeholder="65" />
              </div>
              <div>
                <label className="label">目標体重 (kg)</label>
                <input className="input" type="number" inputMode="decimal" step="0.1" value={data.targetWeight} onChange={(e) => set('targetWeight', e.target.value)} placeholder="60" />
              </div>
            </div>

            <button
              className="btn-primary w-full"
              onClick={() => { const err = validate0(); if (err) toast(err); else setStep(1); }}
            >次へ</button>
          </div>
        )}

        {step === 1 && (
          <div className="animate-fadeUp">
            <h1 className="text-2xl font-bold mb-1">目標を選びましょう</h1>
            <p className="text-ink-dim text-sm mb-6">目標に合わせて栄養バランスを調整します。</p>

            <div className="mb-5">
              <label className="label">活動量</label>
              <div className="flex flex-col gap-2">
                {[
                  { k: 'low', label: '低', sub: 'ほぼ座位、運動なし' },
                  { k: 'mid', label: '中', sub: '立ち仕事 or 週2-3回運動' },
                  { k: 'high', label: '高', sub: '週4回以上のトレーニング' }
                ].map((o) => (
                  <button
                    key={o.k}
                    onClick={() => set('activity', o.k)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition active:scale-[0.99] ${
                      data.activity === o.k ? 'bg-brand-50 border-brand-500' : 'bg-white border-ink-line'
                    }`}
                  >
                    <div className="text-left">
                      <div className={`font-bold text-sm ${data.activity === o.k ? 'text-brand-600' : ''}`}>{o.label}</div>
                      <div className="text-xs text-ink-dim mt-0.5">{o.sub}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 ${data.activity === o.k ? 'border-brand-500 bg-brand-500' : 'border-ink-line'}`}>
                      {data.activity === o.k && <div className="w-full h-full rounded-full border-2 border-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="label">目標</label>
              <div className="flex flex-col gap-2">
                {Object.entries(GOAL_PRESETS).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => set('goal', k)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition active:scale-[0.99] ${
                      data.goal === k ? 'bg-brand-50 border-brand-500' : 'bg-white border-ink-line'
                    }`}
                  >
                    <div className="text-left">
                      <div className={`font-bold text-sm ${data.goal === k ? 'text-brand-600' : ''}`}>{v.label}</div>
                      <div className="text-xs text-ink-dim mt-0.5">
                        {v.kcalAdj > 0 ? `+${v.kcalAdj}` : v.kcalAdj} kcal/日 · 想定 {v.weeklyKg >= 0 ? '+' : ''}{v.weeklyKg}kg/週
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 ${data.goal === k ? 'border-brand-500 bg-brand-500' : 'border-ink-line'}`}>
                      {data.goal === k && <div className="w-full h-full rounded-full border-2 border-white" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setStep(0)}>戻る</button>
              <button className="btn-primary flex-1" onClick={() => { const err = validate1(); if (err) toast(err); else setStep(2); }}>次へ</button>
            </div>
          </div>
        )}

        {step === 2 && targets && (
          <div className="animate-fadeUp">
            <h1 className="text-2xl font-bold mb-1">あなたの目標</h1>
            <p className="text-ink-dim text-sm mb-6">この数値を1日のガイドラインにします。後から変更できます。</p>

            <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 p-5 text-white mb-3">
              <div className="text-xs opacity-90">1日の目標カロリー</div>
              <div className="text-4xl font-bold mt-1">{targets.kcal}<span className="text-lg ml-1 font-normal">kcal</span></div>
              <div className="text-xs opacity-90 mt-1">基礎代謝 {targets.bmr} / 活動代謝 {targets.tdee}</div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              <PfcCard label="P タンパク質" value={targets.protein} color="bg-blue-50 text-blue-600" />
              <PfcCard label="F 脂質" value={targets.fat} color="bg-yellow-50 text-yellow-600" />
              <PfcCard label="C 炭水化物" value={targets.carbs} color="bg-red-50 text-red-600" />
            </div>

            <div className="mb-6">
              <label className="label">会員コード（任意）</label>
              <input className="input" type="text" value={data.memberCode} onChange={(e) => set('memberCode', e.target.value)} placeholder="ONE'S BODY 会員の方のみ" />
              <p className="text-xs text-ink-mute mt-1">トレーナーから配布されたコードを入力すると会員モードになります。</p>
            </div>

            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setStep(1)}>戻る</button>
              <button className="btn-primary flex-1" onClick={finish}>はじめる</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PfcCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl p-3 text-center ${color}`}>
      <div className="text-[10px] font-bold opacity-80">{label}</div>
      <div className="text-xl font-bold mt-1">{value}<span className="text-xs font-normal ml-0.5">g</span></div>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
          <path d="M14 4 L15.5 12.5 L24 14 L15.5 15.5 L14 24 L12.5 15.5 L4 14 L12.5 12.5 Z" fill="#FFF" />
        </svg>
      </div>
      <span className="font-bold text-base tracking-wide">ONE'S MEAL</span>
    </div>
  );
}
