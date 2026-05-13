'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Plus, Trash2, Dumbbell, Activity, Clock, Flame, Minus } from 'lucide-react';
import * as storage from '@/lib/storage';
import { BODY_PARTS, EXERCISES, CARDIO_OPTIONS, setVolume, estimateCardioKcal, estimateStrengthKcal } from '@/lib/training';
import { todayStr, fmtDateJp } from '@/lib/utils';
import type { UserFeatures } from '@/components/layout/Navigation';

export default function TrainingPage() {
  return <TrainingContent />;
}

function TrainingContent() {
  const router = useRouter();
  const { toast } = useToast?.() || ({ toast: () => {} } as any);
  const [profile, setProfile] = useState<any>(null);
  const [features, setFeatures] = useState<UserFeatures>({ featExercise: false, featSleep: false, featWater: false, featSteps: false });
  const [todayWorkouts, setTodayWorkouts] = useState<any[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await storage.getProfile();
      if (!p || !p.sex) { router.replace('/onboarding'); return; }
      setProfile(p);
      setFeatures({
        featExercise: !!(p as any).featExercise,
        featSleep: !!(p as any).featSleep,
        featWater: !!(p as any).featWater,
        featSteps: !!(p as any).featSteps
      });
      await refresh();
    })();
  }, [router]);

  const refresh = async () => {
    setTodayWorkouts(await storage.getWorkoutsByDate(todayStr()));
    setRecentWorkouts(await storage.getRecentWorkouts(20));
  };

  if (!profile) {
    return (
      <AppShell features={features}>
        <div className="flex justify-center py-20"><span className="spinner" /></div>
      </AppShell>
    );
  }

  if (!features.featExercise) {
    return (
      <AppShell features={features}>
        <div className="card text-center py-12">
          <Dumbbell className="w-12 h-12 text-brand-500 mx-auto mb-3" />
          <h2 className="font-bold text-lg mb-2">トレーニング機能はOFFです</h2>
          <p className="text-sm text-ink-dim mb-4">設定からONにすると、有酸素・筋トレを記録できます。</p>
          <button onClick={() => router.push('/settings')} className="btn-primary">設定へ</button>
        </div>
      </AppShell>
    );
  }

  // 今日のサマリー
  const todayKcal = todayWorkouts.reduce((s: number, w: any) => s + (w.kcal || 0), 0);
  const todayMin = todayWorkouts.reduce((s: number, w: any) => s + (w.durationMin || 0), 0);
  const todayVolume = todayWorkouts
    .filter((w: any) => w.type === 'strength')
    .flatMap((w: any) => w.sets || [])
    .reduce((s: number, st: any) => s + setVolume(st.weight, st.reps), 0);

  return (
    <AppShell user={null} features={features}>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl md:text-2xl font-bold">トレーニング</h1>
        <div className="text-sm text-ink-mute">{fmtDateJp(todayStr())}</div>
      </div>

      {/* 今日のサマリー */}
      <div className="card mb-3 bg-gradient-to-br from-brand-500 to-brand-600 text-white">
        <div className="text-xs opacity-90 font-medium">今日の運動</div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <SummaryItem icon={<Clock className="w-4 h-4" />} label="時間" value={`${todayMin}`} unit="分" />
          <SummaryItem icon={<Flame className="w-4 h-4" />} label="消費" value={`${todayKcal}`} unit="kcal" />
          <SummaryItem icon={<Dumbbell className="w-4 h-4" />} label="総負荷" value={`${todayVolume}`} unit="kg" />
        </div>
      </div>

      <button onClick={() => setShowAdd(true)} className="btn-primary w-full mb-3">
        <Plus className="w-4 h-4" /> 新規ワークアウトを記録
      </button>

      {/* 今日のワークアウト */}
      {todayWorkouts.length > 0 && (
        <div className="card mb-3">
          <h2 className="font-bold text-base mb-3">今日のワークアウト</h2>
          <div className="space-y-3">
            {todayWorkouts.map((w: any) => (
              <WorkoutRow key={w.id} workout={w} onDelete={async () => {
                await storage.deleteWorkout(w.id);
                toast('削除しました');
                refresh();
              }} />
            ))}
          </div>
        </div>
      )}

      {/* 履歴 */}
      <div className="card">
        <h2 className="font-bold text-base mb-3">最近のワークアウト</h2>
        {recentWorkouts.length === 0 ? (
          <div className="text-center py-6 text-ink-mute text-sm">まだ記録がありません</div>
        ) : (
          <div className="space-y-2">
            {recentWorkouts.filter((w: any) => w.date !== todayStr()).slice(0, 10).map((w: any) => (
              <WorkoutSummary key={w.id} workout={w} />
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      <AddWorkoutModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        bodyWeight={profile.weightKg}
        onSave={async () => { await refresh(); setShowAdd(false); }}
      />
    </AppShell>
  );
}

function SummaryItem({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: string; unit: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] opacity-90">{icon}{label}</div>
      <div className="text-xl font-bold mt-0.5">{value}<span className="text-[10px] font-normal opacity-80 ml-0.5">{unit}</span></div>
    </div>
  );
}

function WorkoutRow({ workout, onDelete }: { workout: any; onDelete: () => void }) {
  const isCardio = workout.type === 'cardio';
  const totalVolume = (workout.sets || []).reduce((s: number, st: any) => s + setVolume(st.weight, st.reps), 0);
  return (
    <div className="border border-ink-line rounded-xl p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {isCardio ? <Activity className="w-4 h-4 text-brand-500" /> : <Dumbbell className="w-4 h-4 text-brand-500" />}
          <div>
            <div className="font-bold text-sm">{isCardio ? workout.cardioName || '有酸素' : '筋トレ'}</div>
            <div className="text-[10px] text-ink-mute">
              {workout.durationMin ? `${workout.durationMin}分 · ` : ''}
              {workout.kcal ? `${workout.kcal}kcal` : ''}
              {!isCardio && totalVolume > 0 && ` · 総負荷 ${totalVolume}kg`}
            </div>
          </div>
        </div>
        <button onClick={onDelete} className="text-ink-mute hover:text-rose-500 p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {!isCardio && workout.sets && workout.sets.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-ink-line">
          {groupSets(workout.sets).map((g: any, i: number) => (
            <div key={i} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold">{g.exercise}<span className="text-[10px] text-ink-mute ml-1">({getBodyPartLabel(g.bodyPart)})</span></span>
              </div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {g.sets.map((s: any, j: number) => (
                  <span key={j} className="text-[10px] bg-surface-alt px-2 py-0.5 rounded">
                    {s.weight ?? '-'}kg × {s.reps ?? '-'}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {workout.memo && (
        <div className="text-[11px] text-ink-dim italic pt-2 mt-2 border-t border-ink-line">
          {workout.memo}
        </div>
      )}
    </div>
  );
}

function WorkoutSummary({ workout }: { workout: any }) {
  const isCardio = workout.type === 'cardio';
  const totalVolume = (workout.sets || []).reduce((s: number, st: any) => s + setVolume(st.weight, st.reps), 0);
  const setsCount = (workout.sets || []).length;
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-surface-alt rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        {isCardio ? <Activity className="w-4 h-4 text-brand-500 shrink-0" /> : <Dumbbell className="w-4 h-4 text-brand-500 shrink-0" />}
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{isCardio ? workout.cardioName : `筋トレ ${setsCount}セット`}</div>
          <div className="text-[10px] text-ink-mute">
            {workout.date}
            {workout.durationMin ? ` · ${workout.durationMin}分` : ''}
            {workout.kcal ? ` · ${workout.kcal}kcal` : ''}
            {!isCardio && totalVolume > 0 && ` · ${totalVolume}kg`}
          </div>
        </div>
      </div>
    </div>
  );
}

function groupSets(sets: any[]) {
  const map = new Map<string, { exercise: string; bodyPart: string; sets: any[] }>();
  for (const s of sets) {
    const key = `${s.bodyPart}-${s.exercise}`;
    if (!map.has(key)) map.set(key, { exercise: s.exercise, bodyPart: s.bodyPart, sets: [] });
    map.get(key)!.sets.push(s);
  }
  return Array.from(map.values());
}

function getBodyPartLabel(key: string): string {
  return BODY_PARTS.find((p) => p.key === key)?.label || 'その他';
}

/* ---------- AddWorkoutModal ---------- */

interface AddProps {
  open: boolean;
  onClose: () => void;
  bodyWeight: number;
  onSave: () => Promise<void>;
}

function AddWorkoutModal({ open, onClose, bodyWeight, onSave }: AddProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'cardio' | 'strength'>('strength');
  const [cardioName, setCardioName] = useState('ランニング');
  const [cardioOther, setCardioOther] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [kcal, setKcal] = useState('');
  const [memo, setMemo] = useState('');
  // Strength sets
  const [bodyPart, setBodyPart] = useState('chest');
  const [strengthSets, setStrengthSets] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      setTab('strength');
      setCardioName('ランニング'); setCardioOther('');
      setDuration(''); setDistance(''); setKcal(''); setMemo('');
      setBodyPart('chest');
      setStrengthSets([]);
    }
  }, [open]);

  const finalCardioName = cardioName === 'その他' ? cardioOther.trim() || 'その他' : cardioName;

  // 有酸素 kcal 自動計算
  useEffect(() => {
    if (tab !== 'cardio' || !duration) return;
    const auto = estimateCardioKcal(cardioName, +duration || 0, bodyWeight);
    if (!kcal || kcal === String(auto - 1) || kcal === String(auto + 1)) setKcal(String(auto));
    // 直接編集された場合は上書きしない（簡易チェック）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, cardioName]);

  const addSet = (exercise: string) => {
    const existingForExercise = strengthSets.filter((s) => s.exercise === exercise && s.bodyPart === bodyPart);
    const setNumber = existingForExercise.length + 1;
    const lastSet = existingForExercise[existingForExercise.length - 1];
    setStrengthSets([
      ...strengthSets,
      {
        bodyPart, exercise, setNumber,
        weight: lastSet?.weight ?? '',
        reps: lastSet?.reps ?? ''
      }
    ]);
  };

  const updateSet = (i: number, field: 'weight' | 'reps', value: string) => {
    const next = [...strengthSets];
    next[i] = { ...next[i], [field]: value === '' ? '' : Number(value) };
    setStrengthSets(next);
  };

  const removeSet = (i: number) => {
    const next = strengthSets.filter((_, idx) => idx !== i);
    // セット番号を振り直す
    const renumbered: any[] = [];
    const counters: Record<string, number> = {};
    for (const s of next) {
      const key = `${s.bodyPart}-${s.exercise}`;
      counters[key] = (counters[key] || 0) + 1;
      renumbered.push({ ...s, setNumber: counters[key] });
    }
    setStrengthSets(renumbered);
  };

  const totalVolume = useMemo(
    () => strengthSets.reduce((s, st) => s + setVolume(st.weight, st.reps), 0),
    [strengthSets]
  );

  const save = async () => {
    if (tab === 'cardio') {
      if (!finalCardioName) return toast('種目を入力してください');
      if (!duration) return toast('時間を入力してください');
      await storage.addWorkout({
        date: todayStr(),
        type: 'cardio',
        cardioName: finalCardioName,
        durationMin: +duration,
        distanceKm: distance ? +distance : null,
        kcal: kcal ? +kcal : estimateCardioKcal(cardioName, +duration, bodyWeight),
        memo: memo || null,
        sets: []
      });
    } else {
      if (strengthSets.length === 0) return toast('セットを追加してください');
      const valid = strengthSets.every((s) => s.exercise);
      if (!valid) return toast('種目名が必要です');
      const totalDuration = duration ? +duration : 0;
      const estKcal = kcal ? +kcal : estimateStrengthKcal(totalDuration || strengthSets.length * 3, bodyWeight);
      await storage.addWorkout({
        date: todayStr(),
        type: 'strength',
        durationMin: totalDuration || null,
        kcal: estKcal,
        memo: memo || null,
        sets: strengthSets.map((s) => ({
          bodyPart: s.bodyPart,
          exercise: s.exercise,
          setNumber: s.setNumber,
          weight: s.weight === '' ? null : Number(s.weight),
          reps: s.reps === '' ? null : Number(s.reps)
        }))
      });
    }
    toast('記録しました');
    onSave();
  };

  return (
    <Modal open={open} onClose={onClose} title="ワークアウト記録">
      <div className="bg-surface-alt rounded-lg p-1 grid grid-cols-2 mb-4">
        <button onClick={() => setTab('strength')} className={`py-2 text-sm font-bold rounded-md ${tab === 'strength' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-mute'}`}>
          <Dumbbell className="w-4 h-4 inline mr-1" /> 筋トレ
        </button>
        <button onClick={() => setTab('cardio')} className={`py-2 text-sm font-bold rounded-md ${tab === 'cardio' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-mute'}`}>
          <Activity className="w-4 h-4 inline mr-1" /> 有酸素
        </button>
      </div>

      {tab === 'cardio' && (
        <div className="space-y-3">
          <div>
            <label className="label">種目</label>
            <select className="input" value={cardioName} onChange={(e) => setCardioName(e.target.value)}>
              {CARDIO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {cardioName === 'その他' && (
              <input className="input mt-2" type="text" placeholder="例: フィットボクシング" value={cardioOther} onChange={(e) => setCardioOther(e.target.value)} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">時間 (分)</label>
              <input className="input" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" />
            </div>
            <div>
              <label className="label">距離 (km) <span className="text-ink-mute">任意</span></label>
              <input className="input" type="number" step="0.1" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="5.0" />
            </div>
          </div>
          <div>
            <label className="label">消費kcal <span className="text-ink-mute">自動推定値・手動修正可</span></label>
            <input className="input" type="number" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </div>
          <div>
            <label className="label">メモ</label>
            <textarea className="input" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="今日は調子良かった、ペース上がった等" />
          </div>
        </div>
      )}

      {tab === 'strength' && (
        <div className="space-y-3">
          {/* 部位タブ */}
          <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 [scrollbar-width:none]">
            {BODY_PARTS.map((p) => (
              <button
                key={p.key}
                onClick={() => setBodyPart(p.key)}
                className={`shrink-0 chip text-xs ${bodyPart === p.key ? 'chip-active' : ''}`}
              >{p.label}</button>
            ))}
          </div>

          {/* 種目候補 */}
          <div className="flex flex-wrap gap-1.5">
            {EXERCISES[bodyPart].map((ex) => (
              <button key={ex} onClick={() => addSet(ex)} className="text-xs bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-1.5 rounded-lg hover:bg-brand-100">
                + {ex}
              </button>
            ))}
          </div>

          {/* 自由入力 */}
          <AddCustomExercise onAdd={(name) => addSet(name)} />

          {/* セット一覧 */}
          {strengthSets.length > 0 && (
            <div className="bg-surface-alt rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold">追加したセット</span>
                <span className="text-xs text-ink-mute">総負荷: <strong className="text-brand-600">{totalVolume}kg</strong></span>
              </div>
              <div className="space-y-2">
                {strengthSets.map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center bg-white rounded-lg p-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{s.exercise}</div>
                      <div className="text-[10px] text-ink-mute">{getBodyPartLabel(s.bodyPart)} · {s.setNumber}セット目</div>
                    </div>
                    <input className="input !w-20 !min-h-0 !py-1 text-center text-xs" type="number" step="0.5" placeholder="kg"
                      value={s.weight} onChange={(e) => updateSet(i, 'weight', e.target.value)} />
                    <input className="input !w-16 !min-h-0 !py-1 text-center text-xs" type="number" placeholder="回"
                      value={s.reps} onChange={(e) => updateSet(i, 'reps', e.target.value)} />
                    <button onClick={() => removeSet(i)} className="text-ink-mute hover:text-rose-500 p-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label">時間 (分) <span className="text-ink-mute">任意</span></label>
            <input className="input" type="number" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="45" />
          </div>
          <div>
            <label className="label">メモ <span className="text-ink-mute">フォーム改善点など</span></label>
            <textarea className="input" rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-5 pt-4 border-t border-ink-line">
        <button className="btn-secondary flex-1" onClick={onClose}>キャンセル</button>
        <button className="btn-primary flex-1" onClick={save}>記録する</button>
      </div>
    </Modal>
  );
}

function AddCustomExercise({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <div className="flex gap-2">
      <input className="input text-xs" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="その他の種目（自由入力）" />
      <button onClick={() => { if (name.trim()) { onAdd(name.trim()); setName(''); } }} className="btn-secondary !min-h-[40px] !px-3 text-xs shrink-0">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}
