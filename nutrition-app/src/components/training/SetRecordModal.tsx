'use client';
import { useEffect, useState, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Trophy, Play, Pause, RotateCcw, Trash2, Plus, Copy, Calculator, HandMetal } from 'lucide-react';
import { estimate1RM, setVolume, estimateStrengthKcal } from '@/lib/training';
import * as storage from '@/lib/storage';
import { todayStr } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  bodyPart: string;
  exercise: string;
  bodyWeight: number;
  allWorkouts: any[];
  onSaved: () => void;
}

interface LocalSet {
  weight: string;
  reps: string;
  memo: string;
  assisted: boolean;
}

export function SetRecordModal({ open, onClose, bodyPart, exercise, bodyWeight, allWorkouts, onSaved }: Props) {
  const { toast } = useToast();
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [sets, setSets] = useState<LocalSet[]>([]);
  const [memo, setMemo] = useState('');
  const [intervalSec, setIntervalSec] = useState(60);
  const [timerLeft, setTimerLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [showRM, setShowRM] = useState<{ rm: number; weight: number; reps: number } | null>(null);
  const timerRef = useRef<any>(null);

  // 前回の記録を探す
  const lastRecord = findLastRecord(allWorkouts, bodyPart, exercise);
  const bestRM = findBestRM(allWorkouts, bodyPart, exercise);

  useEffect(() => {
    if (!open) return;
    setSets([]);
    setMemo('');
    setIntervalSec(60);
    setTimerLeft(0);
    setTimerRunning(false);
    setShowRM(null);
  }, [open]);

  useEffect(() => {
    if (!timerRunning) return;
    timerRef.current = setInterval(() => {
      setTimerLeft((s) => {
        if (s <= 1) {
          setTimerRunning(false);
          if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(300);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const addSet = () => {
    const last = sets[sets.length - 1];
    setSets([
      ...sets,
      {
        weight: last?.weight || (lastRecord?.[0]?.weight?.toString() ?? ''),
        reps: last?.reps || (lastRecord?.[0]?.reps?.toString() ?? ''),
        memo: '',
        assisted: false
      }
    ]);
  };

  const copyFromLast = () => {
    if (!lastRecord || lastRecord.length === 0) {
      toast('前回の記録がありません');
      return;
    }
    setSets(lastRecord.map((s) => ({
      weight: s.weight != null ? String(s.weight) : '',
      reps: s.reps != null ? String(s.reps) : '',
      memo: '',
      assisted: false
    })));
    toast('前回の記録をコピーしました');
  };

  const updateSet = (i: number, field: keyof LocalSet, value: any) => {
    const next = [...sets];
    (next[i] as any)[field] = value;
    setSets(next);
  };

  const removeSet = (i: number) => {
    setSets(sets.filter((_, idx) => idx !== i));
  };

  const startTimer = () => {
    setTimerLeft(intervalSec);
    setTimerRunning(true);
  };
  const pauseTimer = () => setTimerRunning(false);
  const resetTimer = () => { setTimerRunning(false); setTimerLeft(0); };

  const calcRM = (s: LocalSet) => {
    const w = parseFloat(s.weight) || 0;
    const r = parseFloat(s.reps) || 0;
    if (!w || !r) { toast('重量と回数を入力してください'); return; }
    const rm = estimate1RM(w, r);
    setShowRM({ rm, weight: w, reps: r });
  };

  const totalVolume = sets.reduce((s, st) => s + setVolume(parseFloat(st.weight) || 0, parseFloat(st.reps) || 0), 0);

  const save = async () => {
    const validSets = sets.filter((s) => s.weight || s.reps);
    if (validSets.length === 0) { toast('セットを入力してください'); return; }
    const finalSets = validSets.map((s, i) => {
      let w = parseFloat(s.weight);
      if (unit === 'lbs' && !isNaN(w)) w = w * 0.4536; // lbs to kg
      return {
        bodyPart,
        exercise,
        setNumber: i + 1,
        weight: isNaN(w) ? null : +w.toFixed(1),
        reps: s.reps ? Number(s.reps) : null
      };
    });
    await storage.addWorkout({
      date: todayStr(),
      type: 'strength',
      kcal: estimateStrengthKcal(sets.length * 3, bodyWeight),
      memo: memo || null,
      sets: finalSets
    });
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={exercise}>
      {/* Best RM */}
      {bestRM > 0 && (
        <div className="flex items-center justify-center gap-1.5 mb-3 py-2 bg-amber-50 rounded-lg">
          <Trophy className="w-4 h-4 text-amber-600" />
          <span className="text-xs font-bold text-amber-700">自己ベスト 1RM: {bestRM.toFixed(1)}kg</span>
        </div>
      )}

      {/* インターバルタイマー */}
      <div className="bg-surface-alt rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-ink-dim">インターバル</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              className="input !w-16 !py-1 !min-h-0 text-center text-sm"
              value={intervalSec}
              onChange={(e) => setIntervalSec(Math.max(10, +e.target.value || 0))}
            />
            <span className="text-xs text-ink-mute">秒</span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className={`text-2xl font-bold ${timerRunning ? 'text-brand-600' : timerLeft === 0 ? 'text-ink-mute' : 'text-ink'}`}>
            {timerLeft > 0 ? `${Math.floor(timerLeft / 60)}:${String(timerLeft % 60).padStart(2, '0')}` : '0:00'}
          </div>
          <div className="flex gap-1">
            {!timerRunning ? (
              <button onClick={startTimer} className="bg-brand-500 text-white rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                <Play className="w-3 h-3" /> {timerLeft > 0 ? '再開' : 'START'}
              </button>
            ) : (
              <button onClick={pauseTimer} className="bg-ink-mute text-white rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1">
                <Pause className="w-3 h-3" /> 停止
              </button>
            )}
            <button onClick={resetTimer} className="bg-surface-alt border border-ink-line rounded-lg px-2 py-1.5">
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 前回の記録 */}
      {lastRecord && lastRecord.length > 0 && (
        <div className="bg-surface-alt rounded-xl p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold text-ink-dim">前回の記録</div>
            <button onClick={copyFromLast} className="text-xs text-brand-600 font-bold flex items-center gap-1">
              <Copy className="w-3 h-3" /> コピー
            </button>
          </div>
          <div className="space-y-0.5">
            {lastRecord.map((s: any, i: number) => (
              <div key={i} className="text-xs flex items-center gap-3">
                <span className="text-ink-mute w-4">{i + 1}</span>
                <span className="font-bold">{s.weight}kg × {s.reps}回</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 単位 + 総負荷 */}
      <div className="flex items-center justify-between mb-2">
        <div className="bg-surface-alt rounded-lg p-0.5 flex">
          <button onClick={() => setUnit('kg')} className={`px-3 py-1 text-xs font-bold rounded ${unit === 'kg' ? 'bg-white shadow-sm' : 'text-ink-mute'}`}>kg</button>
          <button onClick={() => setUnit('lbs')} className={`px-3 py-1 text-xs font-bold rounded ${unit === 'lbs' ? 'bg-white shadow-sm' : 'text-ink-mute'}`}>lbs</button>
        </div>
        {sets.length > 0 && (
          <div className="text-xs text-ink-dim">総負荷 <strong className="text-brand-600">{totalVolume}kg</strong></div>
        )}
      </div>

      {/* セット入力 */}
      <div className="space-y-2 mb-3">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-2 bg-white border border-ink-line rounded-lg p-2">
            <span className="text-xs font-bold w-5 text-ink-mute">{i + 1}</span>
            <input
              type="number"
              step="0.5"
              inputMode="decimal"
              className="input !w-20 !py-1.5 !min-h-0 text-center text-sm"
              value={s.weight}
              onChange={(e) => updateSet(i, 'weight', e.target.value)}
              placeholder={unit}
            />
            <span className="text-xs text-ink-mute">×</span>
            <input
              type="number"
              inputMode="numeric"
              className="input !w-16 !py-1.5 !min-h-0 text-center text-sm"
              value={s.reps}
              onChange={(e) => updateSet(i, 'reps', e.target.value)}
              placeholder="回"
            />
            <button
              onClick={() => updateSet(i, 'assisted', !s.assisted)}
              title="補助あり"
              className={`p-1.5 rounded ${s.assisted ? 'bg-amber-100 text-amber-700' : 'text-ink-mute hover:bg-surface-alt'}`}
            >
              <HandMetal className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => calcRM(s)} title="1RM計算" className="p-1.5 text-ink-mute hover:bg-surface-alt rounded">
              <Calculator className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => removeSet(i)} className="p-1.5 text-ink-mute hover:text-rose-500">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button onClick={addSet} className="btn-ghost w-full !py-2">
          <Plus className="w-4 h-4" /> セットを追加
        </button>
      </div>

      {/* メモ */}
      <textarea
        className="input"
        rows={2}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="メモ（フォーム改善点、感触など）"
      />

      <div className="flex gap-2 mt-4">
        <button className="btn-secondary flex-1" onClick={onClose}>キャンセル</button>
        <button className="btn-primary flex-1" onClick={save}>記録する</button>
      </div>

      {/* RM計算結果 */}
      {showRM && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={() => setShowRM(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
            <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <div className="text-xs text-ink-mute mb-1">推定 1RM</div>
            <div className="text-4xl font-bold text-brand-600 mb-2">{showRM.rm.toFixed(1)}<span className="text-base ml-1 text-ink-dim">kg</span></div>
            <div className="text-xs text-ink-dim mb-4">{showRM.weight}kg × {showRM.reps}回 から算出（Brzycki式）</div>
            <button onClick={() => setShowRM(null)} className="btn-primary w-full">閉じる</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function findLastRecord(allWorkouts: any[], bodyPart: string, exercise: string): any[] | null {
  // 同じ部位・種目の最後の記録を探す
  for (const w of allWorkouts) {
    if (w.type !== 'strength') continue;
    const matchingSets = (w.sets || []).filter((s: any) => s.bodyPart === bodyPart && s.exercise === exercise);
    if (matchingSets.length > 0) {
      return matchingSets;
    }
  }
  return null;
}

function findBestRM(allWorkouts: any[], bodyPart: string, exercise: string): number {
  let best = 0;
  for (const w of allWorkouts) {
    if (w.type !== 'strength') continue;
    for (const s of (w.sets || [])) {
      if (s.bodyPart === bodyPart && s.exercise === exercise) {
        const rm = estimate1RM(s.weight, s.reps);
        if (rm > best) best = rm;
      }
    }
  }
  return best;
}
