'use client';
import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Trophy, Play, Pause, RotateCcw, Trash2, Plus, Minus, Copy, Calculator, HandMetal, Timer } from 'lucide-react';
import { estimate1RM, setVolume, estimateStrengthKcal } from '@/lib/training';
import * as storage from '@/lib/storage';
import { todayStr } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

interface ExistingSet {
  id?: string;
  workoutId: string;
  weight: number | null;
  reps: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  bodyPart: string;
  exercise: string;
  bodyWeight: number;
  allWorkouts: any[];
  onSaved: () => void;
  targetDate?: string;
  existingSets?: ExistingSet[];   // 既存セット編集モード
}

interface LocalSet {
  weight: number | null;
  reps: number | null;
  memo: string;
  assisted: boolean;
}

export function SetRecordModal({ open, onClose, bodyPart, exercise, bodyWeight, allWorkouts, onSaved, targetDate, existingSets }: Props) {
  const { toast } = useToast();
  const [unit, setUnit] = useState<'kg' | 'lbs'>('kg');
  const [sets, setSets] = useState<LocalSet[]>([]);
  const [memo, setMemo] = useState('');
  const [intervalSec, setIntervalSec] = useState(60);
  const [timerLeft, setTimerLeft] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [showRM, setShowRM] = useState<{ rm: number; weight: number; reps: number } | null>(null);
  const [saveError, setSaveError] = useState<{ stage: string; detail: string; code?: string | null; status?: number } | null>(null);
  const timerRef = useRef<any>(null);

  const lastRecord = findLastRecord(allWorkouts, bodyPart, exercise);
  const bestRM = findBestRM(allWorkouts, bodyPart, exercise);
  const date = targetDate || todayStr();

  useEffect(() => {
    if (!open) return;
    if (existingSets && existingSets.length > 0) {
      // 編集モード：既存セットの値で初期化
      setSets(existingSets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        memo: '',
        assisted: false
      })));
    } else {
      // 新規モード：前回の値を引き継いだ1セットから始める
      setSets([{
        weight: lastRecord?.[0]?.weight ?? null,
        reps: lastRecord?.[0]?.reps ?? null,
        memo: '',
        assisted: false
      }]);
    }
    setMemo('');
    setIntervalSec(60);
    setTimerLeft(0);
    setTimerRunning(false);
    setTimerOpen(false);
    setShowRM(null);
  }, [open, exercise, bodyPart]);

  // タイマー
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
    setSets([...sets, {
      weight: last?.weight ?? null,
      reps: last?.reps ?? null,
      memo: '',
      assisted: false
    }]);
  };

  const copyFromLast = () => {
    if (!lastRecord || lastRecord.length === 0) {
      toast('前回の記録がありません');
      return;
    }
    setSets(lastRecord.map((s: any) => ({
      weight: s.weight ?? null,
      reps: s.reps ?? null,
      memo: '',
      assisted: false
    })));
    toast('前回の記録をコピーしました');
  };

  const updateSet = (i: number, patch: Partial<LocalSet>) => {
    const next = [...sets];
    next[i] = { ...next[i], ...patch };
    setSets(next);
  };

  const removeSet = (i: number) => {
    if (sets.length === 1) {
      setSets([{ weight: null, reps: null, memo: '', assisted: false }]);
      return;
    }
    setSets(sets.filter((_, idx) => idx !== i));
  };

  const startTimer = () => {
    setTimerLeft(intervalSec);
    setTimerRunning(true);
    setTimerOpen(true);
  };
  const pauseTimer = () => setTimerRunning(false);
  const resetTimer = () => { setTimerRunning(false); setTimerLeft(0); };

  const calcRM = (s: LocalSet) => {
    if (!s.weight || !s.reps) { toast('重量と回数を入力してください'); return; }
    const rm = estimate1RM(s.weight, s.reps);
    setShowRM({ rm, weight: s.weight, reps: s.reps });
  };

  const totalVolume = sets.reduce((s, st) => s + setVolume(st.weight, st.reps), 0);

  const save = async () => {
    const valid = sets.filter((s) => s.weight != null || s.reps != null);
    if (valid.length === 0) { toast('セットを入力してください'); return; }
    const finalSets = valid.map((s, i) => {
      let w = s.weight ?? null;
      if (unit === 'lbs' && w != null) w = +(w * 0.4536).toFixed(1);
      return {
        bodyPart,
        exercise,
        setNumber: i + 1,
        weight: w,
        reps: s.reps
      };
    });

    // 編集モード：サーバー側のアトミックな置換APIを使用（既存削除+新規追加を1トランザクションで実行）
    if (existingSets && existingSets.length > 0) {
      setSaveError(null);
      try {
        const payload = {
          date,
          bodyPart,
          exercise,
          sets: finalSets.map((s, i) => ({
            weight: s.weight,
            reps: s.reps,
            setNumber: i + 1
          })),
          kcal: estimateStrengthKcal(sets.length * 3, bodyWeight),
          memo: memo || null
        };
        const res = await fetch('/api/strength-sets/replace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const errText = !res.ok ? await res.text() : null;
        if (!res.ok) {
          let errBody: any = {};
          try { errBody = JSON.parse(errText || '{}'); } catch {}
          setSaveError({
            stage: 'api',
            detail: errBody.detail || errBody.error || errText || `HTTP ${res.status}`,
            code: errBody.code || null,
            status: res.status
          });
          return;
        }
        onSaved();
        return;
      } catch (e: any) {
        setSaveError({ stage: 'network', detail: e?.message || String(e) });
        return;
      }
    }

    // 新規モード
    await storage.addWorkout({
      date,
      type: 'strength',
      kcal: estimateStrengthKcal(sets.length * 3, bodyWeight),
      memo: memo || null,
      sets: finalSets
    });
    onSaved();
  };

  return (
    <Modal open={open} onClose={onClose} title={exercise}>
      {/* 上部 — Best RM + 履歴コピー + 単位 + タイマー */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {bestRM > 0 && (
            <div className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
              <Trophy className="w-3 h-3" /> 自己ベスト {bestRM.toFixed(0)}kg
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* 単位切替（kg/lbs）*/}
          <div className="bg-surface-alt rounded-md p-0.5 flex">
            <button onClick={() => setUnit('kg')} className={`px-2 py-0.5 text-[10px] font-bold rounded ${unit === 'kg' ? 'bg-white shadow-sm' : 'text-ink-mute'}`}>kg</button>
            <button onClick={() => setUnit('lbs')} className={`px-2 py-0.5 text-[10px] font-bold rounded ${unit === 'lbs' ? 'bg-white shadow-sm' : 'text-ink-mute'}`}>lbs</button>
          </div>
          {/* インターバルタイマー（右上に小さく） */}
          <button
            onClick={() => setTimerOpen(!timerOpen)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border ${
              timerRunning ? 'bg-brand-500 text-white border-brand-500' : 'border-ink-line text-ink-dim'
            }`}
          >
            <Timer className="w-3 h-3" />
            {timerRunning ? `${Math.floor(timerLeft / 60)}:${String(timerLeft % 60).padStart(2, '0')}` : 'タイマー'}
          </button>
        </div>
      </div>

      {/* タイマーパネル（折りたたみ） */}
      {timerOpen && (
        <div className="bg-surface-alt rounded-lg p-2.5 mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              className="input !w-14 !py-1 !min-h-0 text-center text-xs"
              value={intervalSec}
              onChange={(e) => setIntervalSec(Math.max(10, +e.target.value || 0))}
            />
            <span className="text-[10px] text-ink-mute">秒</span>
          </div>
          <div className={`text-lg font-bold ${timerRunning ? 'text-brand-600' : 'text-ink-mute'}`}>
            {timerLeft > 0 ? `${Math.floor(timerLeft / 60)}:${String(timerLeft % 60).padStart(2, '0')}` : '0:00'}
          </div>
          <div className="flex gap-1">
            {!timerRunning ? (
              <button onClick={startTimer} className="bg-brand-500 text-white rounded px-2 py-1 text-[10px] font-bold flex items-center gap-1">
                <Play className="w-3 h-3" /> START
              </button>
            ) : (
              <button onClick={pauseTimer} className="bg-ink-mute text-white rounded px-2 py-1 text-[10px] font-bold">
                <Pause className="w-3 h-3" />
              </button>
            )}
            <button onClick={resetTimer} className="bg-white border border-ink-line rounded px-1.5 py-1">
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 前回の記録 */}
      {lastRecord && lastRecord.length > 0 && (
        <div className="bg-surface-alt rounded-xl p-2.5 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-xs font-bold text-ink-dim">前回の記録</div>
            <button onClick={copyFromLast} className="text-xs text-brand-600 font-bold flex items-center gap-1">
              <Copy className="w-3 h-3" /> コピー
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {lastRecord.map((s: any, i: number) => (
              <span key={i} className="text-[10px] bg-white px-2 py-0.5 rounded font-medium">
                {s.weight}kg×{s.reps}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* セット一覧 — 直感入力 */}
      <div className="space-y-2 mb-4">
        {sets.map((s, i) => (
          <SetRow
            key={i}
            index={i + 1}
            set={s}
            unit={unit}
            onChange={(patch) => updateSet(i, patch)}
            onCalcRM={() => calcRM(s)}
            onRemove={() => removeSet(i)}
          />
        ))}
        {/* 余白 + セット追加ボタンを固定配置 */}
        <div className="pt-2">
          <button onClick={addSet} className="btn-ghost w-full !py-3">
            <Plus className="w-4 h-4" /> セットを追加
          </button>
        </div>
      </div>

      {/* 総負荷 — 常に同じ位置に表示（位置が動かないよう確保） */}
      <div className="bg-surface-alt rounded-lg p-2.5 mb-3 text-center text-xs text-ink-dim">
        総負荷 <strong className="text-brand-600 text-base ml-1">{totalVolume}<span className="text-xs font-normal">kg</span></strong>
      </div>

      <textarea
        className="input mb-3"
        rows={2}
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        placeholder="メモ（フォーム改善点・感触など）"
      />

      {/* エラー詳細表示（編集モードで保存失敗時） */}
      {saveError && (
        <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 mb-2 mt-2">
          <div className="text-xs font-bold text-rose-700 mb-1">
            更新失敗{saveError.status ? ` (HTTP ${saveError.status})` : ''}
          </div>
          <div className="text-[11px] text-rose-700 leading-relaxed whitespace-pre-wrap break-all">
            {saveError.detail}
          </div>
          {saveError.code && (
            <div className="text-[10px] text-rose-500 mt-1">エラーコード: {saveError.code}</div>
          )}
          <button
            onClick={() => setSaveError(null)}
            className="text-[11px] text-rose-700 underline mt-2"
          >閉じる</button>
        </div>
      )}

      {/* 下部固定ボタン */}
      <div className="flex gap-2 sticky bottom-0 bg-white pt-2 -mx-1 px-1 pb-1">
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
            <div className="text-xs text-ink-dim mb-4">{showRM.weight}kg × {showRM.reps}回 から算出</div>
            <button onClick={() => setShowRM(null)} className="btn-primary w-full">閉じる</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ---------- セット行：大きい数値 + +/- ボタン + スワイプ ---------- */

function SetRow({
  index, set, unit, onChange, onCalcRM, onRemove
}: {
  index: number;
  set: LocalSet;
  unit: 'kg' | 'lbs';
  onChange: (patch: Partial<LocalSet>) => void;
  onCalcRM: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-white border border-ink-line rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-ink-mute">{index}セット目</span>
        <div className="flex items-center gap-1">
          <button onClick={() => onChange({ assisted: !set.assisted })}
            title="補助あり"
            className={`p-1.5 rounded text-[10px] flex items-center gap-1 ${set.assisted ? 'bg-amber-100 text-amber-700' : 'text-ink-mute hover:bg-surface-alt'}`}
          >
            <HandMetal className="w-3 h-3" /> {set.assisted ? '補助' : ''}
          </button>
          <button onClick={onCalcRM} title="1RM計算" className="p-1.5 text-ink-mute hover:bg-surface-alt rounded">
            <Calculator className="w-3.5 h-3.5" />
          </button>
          <button onClick={onRemove} className="p-1.5 text-ink-mute hover:text-rose-500">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberStepper
          label={unit}
          value={set.weight}
          onChange={(v) => onChange({ weight: v })}
          step={2.5}
          bigStep={5}
          min={0}
          max={500}
          decimals={1}
        />
        <NumberStepper
          label="回"
          value={set.reps}
          onChange={(v) => onChange({ reps: v })}
          step={1}
          bigStep={5}
          min={0}
          max={100}
          decimals={0}
        />
      </div>
    </div>
  );
}

/* ---------- 数値ステッパー（+/- 大ボタン + 編集可能な大きい数値） ---------- */
function NumberStepper({
  label, value, onChange, step, bigStep, min, max, decimals
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step: number;
  bigStep: number;
  min: number;
  max: number;
  decimals: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const display = value == null ? '–' : value.toFixed(decimals);

  const change = (delta: number) => {
    const cur = value ?? 0;
    const next = Math.min(max, Math.max(min, +(cur + delta).toFixed(decimals)));
    onChange(next);
  };

  return (
    <div className="bg-surface-alt rounded-lg overflow-hidden">
      <div className="flex items-stretch">
        <button
          onClick={() => change(-step)}
          className="px-2 hover:bg-ink-line/30 active:bg-ink-line/50 transition flex items-center justify-center"
          aria-label={`-${step}`}
        >
          <Minus className="w-4 h-4 text-ink-dim" />
        </button>
        <div className="flex-1 text-center py-2.5">
          {editing ? (
            <input
              type="number"
              inputMode="decimal"
              step={step}
              autoFocus
              className="w-full bg-transparent text-center text-2xl font-bold outline-none"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                const n = parseFloat(draft);
                if (!isNaN(n)) onChange(Math.min(max, Math.max(min, +n.toFixed(decimals))));
                setEditing(false);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
          ) : (
            <button
              onClick={() => { setDraft(value == null ? '' : String(value)); setEditing(true); }}
              className="w-full"
            >
              <div className="text-2xl font-bold leading-tight">{display}</div>
              <div className="text-[9px] text-ink-mute mt-0.5">{label}</div>
            </button>
          )}
        </div>
        <button
          onClick={() => change(step)}
          className="px-2 hover:bg-ink-line/30 active:bg-ink-line/50 transition flex items-center justify-center"
          aria-label={`+${step}`}
        >
          <Plus className="w-4 h-4 text-ink-dim" />
        </button>
      </div>
      {/* 大きい刻みのバー（オプション）*/}
      <div className="grid grid-cols-2 border-t border-ink-line/50">
        <button
          onClick={() => change(-bigStep)}
          className="py-1 text-[10px] text-ink-mute hover:bg-ink-line/30 transition"
        >-{bigStep}</button>
        <button
          onClick={() => change(bigStep)}
          className="py-1 text-[10px] text-ink-mute hover:bg-ink-line/30 transition border-l border-ink-line/50"
        >+{bigStep}</button>
      </div>
    </div>
  );
}

function findLastRecord(allWorkouts: any[], bodyPart: string, exercise: string): any[] | null {
  for (const w of allWorkouts) {
    if (w.type !== 'strength') continue;
    const matchingSets = (w.sets || []).filter((s: any) => s.bodyPart === bodyPart && s.exercise === exercise);
    if (matchingSets.length > 0) return matchingSets;
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
