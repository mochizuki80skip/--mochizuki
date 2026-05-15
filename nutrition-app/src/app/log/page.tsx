'use client';
import { useEffect, useState, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Search, Camera, Pencil, Trash2, Plus, Minus, Sun, Moon, UtensilsCrossed, Cookie, Clock, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import * as storage from '@/lib/storage';
import { searchFoods, getFood, scaleFood, FOOD_CATEGORIES, type Food } from '@/lib/foods';
import { calcTargets, sumByMeal, sumDay, type Targets } from '@/lib/nutrition';
import { todayStr, fmtDateJp } from '@/lib/utils';
import type { UserFeatures } from '@/components/layout/Navigation';
import { getInitialFeatures, saveFeatures } from '@/lib/features-cache';
import { useRequireLogin } from '@/lib/use-login-check';

const MEAL_LABELS = { breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' } as const;
const MEAL_ICONS = {
  breakfast: Sun,
  lunch: UtensilsCrossed,
  dinner: Moon,
  snack: Cookie
};
type MealSlot = keyof typeof MEAL_LABELS;

export default function LogPage() {
  return <LogContent />;
}

function LogContent() {
  useRequireLogin();
  const [profile, setProfile] = useState<any>(null);
  const [features, setFeatures] = useState<UserFeatures>(getInitialFeatures());
  const [targets, setTargets] = useState<Targets | null>(null);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [weekMeals, setWeekMeals] = useState<Map<string, { kcal: number; count: number }>>(new Map());

  // 食品追加モーダル状態
  const [addSlot, setAddSlot] = useState<MealSlot | null>(null);
  // 食品編集モーダル状態
  const [editMeal, setEditMeal] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const p = await storage.getProfile();
      if (!p || !p.sex) { window.location.href = '/onboarding'; return; }
      setProfile(p);
      setTargets(calcTargets(p));
      const nf = {
        featExercise: !!(p as any).featExercise,
        featSleep: !!(p as any).featSleep,
        featWater: !!(p as any).featWater,
        featSteps: !!(p as any).featSteps
      };
      setFeatures(nf);
      saveFeatures(nf);
    })();
  }, []);

  // 選択日が変わったら、まず当日の食事だけを優先的に取得（速い）
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      const meals = await storage.getMealsByDate(selectedDate);
      if (!cancelled) setTodayMeals(meals);
    })();
    return () => { cancelled = true; };
  }, [selectedDate, profile]);

  // 週カレンダーの達成リング用データは背景で遅延取得（メイン描画をブロックしない）
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    // 1週間内であれば既存データを流用、それを超えたら再取得
    const t = setTimeout(async () => {
      const sel = new Date(selectedDate);
      const dow = sel.getDay();
      const sunday = new Date(sel); sunday.setDate(sel.getDate() - dow);
      const sat = new Date(sunday); sat.setDate(sunday.getDate() + 6);
      const from = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
      const to = `${sat.getFullYear()}-${String(sat.getMonth() + 1).padStart(2, '0')}-${String(sat.getDate()).padStart(2, '0')}`;
      try {
        const range = await storage.getMealsRange(from, to);
        if (cancelled) return;
        const map = new Map<string, { kcal: number; count: number }>();
        for (const m of range) {
          const cur = map.get(m.date) || { kcal: 0, count: 0 };
          cur.kcal += m.kcal || 0;
          cur.count += 1;
          map.set(m.date, cur);
        }
        setWeekMeals(map);
      } catch {}
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [selectedDate, profile]);

  const refresh = async () => {
    const meals = await storage.getMealsByDate(selectedDate);
    setTodayMeals(meals);
    // 当日分の weekMeals を即座にローカル更新（リング即反映、再取得不要）
    const totalKcal = meals.reduce((s: number, m: any) => s + (m.kcal || 0), 0);
    setWeekMeals((prev) => {
      const next = new Map(prev);
      next.set(selectedDate, { kcal: totalKcal, count: meals.length });
      return next;
    });
  };

  if (!profile || !targets) {
    return (
      <AppShell features={features}>
        <div className="flex justify-center py-20"><span className="spinner" /></div>
      </AppShell>
    );
  }

  const byMeal = sumByMeal(todayMeals);
  const todaySum = sumDay(todayMeals);
  const kcalRem = targets.kcal - todaySum.kcal;

  return (
    <AppShell user={null} features={features}>
      {/* 上部の週カレンダー（月+週+達成リング） */}
      <WeekCalendar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        weekMeals={weekMeals}
        kcalTarget={targets.kcal}
      />

      {/* 日付ヘッダー */}
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl md:text-2xl font-bold">食事記録</h1>
        <div className="text-sm text-ink-mute">{fmtDateJp(selectedDate)}{selectedDate !== todayStr() && <button onClick={() => setSelectedDate(todayStr())} className="ml-2 text-[10px] text-brand-600 font-bold underline">今日へ</button>}</div>
      </div>

      {/* メーター */}
      <div className="card mb-4 bg-gradient-to-br from-brand-500 to-brand-600 text-white">
        <div className="flex justify-between items-baseline mb-2">
          <div>
            <div className="text-xs opacity-90 font-medium">摂取カロリー</div>
            <div className="text-3xl md:text-4xl font-bold mt-0.5 tracking-tight">
              {Math.round(todaySum.kcal)}
              <span className="text-sm font-normal opacity-90 ml-1">/ {targets.kcal} kcal</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-90 font-medium">残り</div>
            <div className={`text-xl font-bold ${kcalRem < 0 ? 'text-yellow-100' : ''}`}>
              {kcalRem >= 0 ? '+' : ''}{kcalRem}
            </div>
          </div>
        </div>
        <ProgressBar value={todaySum.kcal} target={targets.kcal} color="bg-white/90" className="bg-white/20" />
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
          <PfcMini label="P" value={todaySum.protein} target={targets.protein} />
          <PfcMini label="F" value={todaySum.fat} target={targets.fat} />
          <PfcMini label="C" value={todaySum.carbs} target={targets.carbs} />
        </div>
      </div>

      {/* 食事区分カード（あすけん風） */}
      <div className="space-y-3">
        {(Object.keys(MEAL_LABELS) as MealSlot[]).map((slot) => {
          const items = byMeal[slot];
          const kcal = items.reduce((a: number, b: any) => a + b.kcal, 0);
          const Icon = MEAL_ICONS[slot];
          return (
            <div key={slot} className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-brand-600" />
                  </div>
                  <div>
                    <div className="font-bold">{MEAL_LABELS[slot]}</div>
                    <div className="text-[11px] text-ink-mute">{items.length} 件 · {kcal} kcal</div>
                  </div>
                </div>
                <button
                  onClick={() => setAddSlot(slot)}
                  className="flex items-center gap-1 text-brand-600 font-bold text-sm hover:bg-brand-50 px-3 py-1.5 rounded-lg transition"
                >
                  <Plus className="w-4 h-4" /> 追加
                </button>
              </div>

              {items.length === 0 ? (
                <button
                  onClick={() => setAddSlot(slot)}
                  className="w-full border border-dashed border-ink-line rounded-lg py-4 text-xs text-ink-mute hover:bg-surface-alt transition"
                >
                  食品を追加してください
                </button>
              ) : (
                <ul className="space-y-2">
                  {items.map((it: any) => (
                    <li key={it.id} className="flex items-center justify-between p-2 hover:bg-surface-alt rounded-lg transition">
                      <button
                        onClick={() => setEditMeal(it)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="text-sm font-medium truncate">{it.name}</div>
                        <div className="text-[10px] text-ink-mute">
                          {it.qty && it.unit ? `${it.qty} × ${it.unit} · ` : ''}{it.kcal} kcal · P {it.protein}g · F {it.fat}g · C {it.carbs}g
                        </div>
                      </button>
                      <button
                        onClick={async () => { await storage.deleteMeal(it.id); refresh(); }}
                        className="ml-2 p-2 text-ink-mute hover:text-rose-500 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* 食品追加モーダル */}
      <AddFoodModal
        slot={addSlot}
        date={selectedDate}
        onClose={() => setAddSlot(null)}
        onAdded={refresh}
      />

      {/* 食品編集モーダル（量・栄養値の編集） */}
      <EditMealModal
        meal={editMeal}
        onClose={() => setEditMeal(null)}
        onSaved={() => { setEditMeal(null); refresh(); }}
      />
    </AppShell>
  );
}

function PfcMini({ label, value, target }: { label: string; value: number; target: number }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline text-[10px] opacity-90 mb-1">
        <span className="font-bold">{label}</span>
        <span>{value.toFixed(0)}<span className="opacity-70">/{target}g</span></span>
      </div>
      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-white/90 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- AddFoodModal: 検索/写真/手入力 統合 ---------- */

/* ---------- EditMealModal: 登録済み食品の量・栄養を編集 ---------- */
function EditMealModal({ meal, onClose, onSaved }: { meal: any | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [qty, setQty] = useState<number>(1);
  const [unit, setUnit] = useState<string>('1人前');
  const [original, setOriginal] = useState<{ kcal: number; protein: number; fat: number; carbs: number; qty: number } | null>(null);
  const [kcal, setKcal] = useState<number>(0);
  const [protein, setProtein] = useState<number>(0);
  const [fat, setFat] = useState<number>(0);
  const [carbs, setCarbs] = useState<number>(0);
  const [scaleMode, setScaleMode] = useState(true); // 量変更時に栄養を比例スケールするか

  useEffect(() => {
    if (!meal) return;
    setQty(meal.qty || 1);
    setUnit(meal.unit || '1人前');
    setKcal(meal.kcal || 0);
    setProtein(meal.protein || 0);
    setFat(meal.fat || 0);
    setCarbs(meal.carbs || 0);
    setOriginal({
      kcal: meal.kcal || 0,
      protein: meal.protein || 0,
      fat: meal.fat || 0,
      carbs: meal.carbs || 0,
      qty: meal.qty || 1
    });
    setScaleMode(true);
  }, [meal?.id]);

  // 量変更時に栄養値を比例スケール
  const onQtyChange = (newQty: number) => {
    setQty(newQty);
    if (scaleMode && original && original.qty > 0) {
      const ratio = newQty / original.qty;
      setKcal(Math.round(original.kcal * ratio));
      setProtein(+(original.protein * ratio).toFixed(1));
      setFat(+(original.fat * ratio).toFixed(1));
      setCarbs(+(original.carbs * ratio).toFixed(1));
    }
  };

  const save = async () => {
    if (!meal) return;
    try {
      await storage.updateMeal(meal.id, { qty, unit, kcal, protein, fat, carbs });
      toast('更新しました');
      onSaved();
    } catch (e: any) {
      toast(`更新失敗: ${e?.message || String(e)}`);
    }
  };

  if (!meal) return null;

  // 単位が個数系か判定
  const isPieceUnit = /(?:個|枚|杯|玉|切れ|本|串|尾|人前)/.test(unit);
  const step = isPieceUnit ? 0.5 : 10;

  return (
    <Modal open={!!meal} onClose={onClose} title="食品を編集">
      <div className="space-y-3">
        <div>
          <div className="text-xs text-ink-mute">食品名</div>
          <div className="font-bold">{meal.name}</div>
        </div>

        {/* 量 */}
        <div>
          <label className="label">量（{unit}）</label>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary !min-h-[44px] !px-3"
              onClick={() => onQtyChange(Math.max(0, +(qty - step).toFixed(1)))}
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              className="input text-center text-lg font-bold"
              type="number"
              inputMode="decimal"
              step={step}
              value={qty}
              onChange={(e) => onQtyChange(+e.target.value || 0)}
            />
            <button
              className="btn-secondary !min-h-[44px] !px-3"
              onClick={() => onQtyChange(+(qty + step).toFixed(1))}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <label className="flex items-center gap-2 mt-2 text-[11px] text-ink-dim">
            <input
              type="checkbox"
              checked={scaleMode}
              onChange={(e) => setScaleMode(e.target.checked)}
            />
            量を変更したら栄養値も自動でスケール
          </label>
        </div>

        {/* 栄養値 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">カロリー (kcal)</label>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              value={kcal}
              onChange={(e) => { setKcal(+e.target.value || 0); setScaleMode(false); }}
            />
          </div>
          <div>
            <label className="label">タンパク質 (g)</label>
            <input
              className="input"
              type="number"
              step="0.1"
              value={protein}
              onChange={(e) => { setProtein(+e.target.value || 0); setScaleMode(false); }}
            />
          </div>
          <div>
            <label className="label">脂質 (g)</label>
            <input
              className="input"
              type="number"
              step="0.1"
              value={fat}
              onChange={(e) => { setFat(+e.target.value || 0); setScaleMode(false); }}
            />
          </div>
          <div>
            <label className="label">炭水化物 (g)</label>
            <input
              className="input"
              type="number"
              step="0.1"
              value={carbs}
              onChange={(e) => { setCarbs(+e.target.value || 0); setScaleMode(false); }}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button className="btn-secondary flex-1" onClick={onClose}>キャンセル</button>
          <button className="btn-primary flex-1" onClick={save}>保存</button>
        </div>
      </div>
    </Modal>
  );
}

function AddFoodModal({ slot, date, onClose, onAdded }: { slot: MealSlot | null; date: string; onClose: () => void; onAdded: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'home' | 'search' | 'photo' | 'manual'>('home');
  const [cat, setCat] = useState('すべて');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [qty, setQty] = useState(1);
  const [manual, setManual] = useState({ name: '', kcal: '', protein: '', fat: '', carbs: '' });
  // AI テキスト入力モード
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ name: string; unitDesc: string; unitG: number; kcal: number; protein: number; fat: number; carbs: number } | null>(null);
  const [aiQty, setAiQty] = useState(1);
  const [aiTextError, setAiTextError] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<{ stage: string; detail: string } | null>(null);
  const [photoHint, setPhotoHint] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null); // 写真選択後の画像（解析前）
  const [aiDiag, setAiDiag] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const runAiDiag = async () => {
    setDiagLoading(true);
    setAiDiag(null);
    try {
      const res = await fetch('/api/ai/diag');
      setAiDiag(await res.json());
    } catch (e: any) {
      setAiDiag({ ok: false, reason: e?.message || String(e) });
    } finally {
      setDiagLoading(false);
    }
  };

  useEffect(() => {
    if (slot) {
      setTab('home');
      setQuery(''); setCat('すべて'); setSelected(null); setQty(1);
      setManual({ name: '', kcal: '', protein: '', fat: '', carbs: '' });
      (async () => setHistory((await storage.getRecentMeals(20)).slice(0, 20)))();
    }
  }, [slot]);

  useEffect(() => { setResults(searchFoods(query, cat)); }, [query, cat]);

  if (!slot) return null;

  const scaled = selected ? scaleFood(selected, qty) : null;

  const addFood = async () => {
    if (!selected) return;
    const s = scaleFood(selected, qty);
    await storage.addMeal({
      date: date, meal: slot,
      name: s.name, qty: s.qty, unit: s.unit,
      kcal: s.kcal, protein: s.protein, fat: s.fat, carbs: s.carbs, source: 'db'
    });
    toast(`${s.name} を追加`);
    onAdded();
    onClose();
  };

  const addFromHistory = async (h: any) => {
    await storage.addMeal({
      date: date, meal: slot,
      name: h.name, qty: h.qty || 1, unit: h.unit || '1人前',
      kcal: h.kcal, protein: h.protein, fat: h.fat, carbs: h.carbs, source: 'manual'
    });
    toast('再追加しました');
    onAdded();
    onClose();
  };

  // AI テキスト推定
  const runAiText = async () => {
    if (!aiInput.trim()) { toast('食品名を入力してください'); return; }
    setAiLoading(true);
    setAiTextError(null);
    try {
      const res = await fetch('/api/ai/food-text', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: aiInput.trim() })
      });
      const data = await res.json();
      if (data.food) {
        setAiResult(data.food);
        setAiQty(1);
      } else {
        setAiTextError(data.diagnostic?.detail || 'AI推定に失敗しました');
      }
    } catch (e: any) {
      setAiTextError(`通信エラー: ${e?.message || String(e)}`);
    } finally {
      setAiLoading(false);
    }
  };

  const saveAiResult = async () => {
    if (!aiResult) return;
    const q = aiQty || 1;
    await storage.addMeal({
      date: date, meal: slot,
      name: aiResult.name,
      qty: q,
      unit: aiResult.unitDesc,
      kcal: Math.round(aiResult.kcal * q),
      protein: +(aiResult.protein * q).toFixed(1),
      fat: +(aiResult.fat * q).toFixed(1),
      carbs: +(aiResult.carbs * q).toFixed(1),
      source: 'ai-text'
    });
    toast(`${aiResult.name} を追加しました`);
    setAiInput('');
    setAiResult(null);
    setAiQty(1);
    onAdded();
    onClose();
  };

  const saveManual = async () => {
    if (!manual.name.trim()) return toast('食品名を入力してください');
    await storage.addMeal({
      date: date, meal: slot,
      name: manual.name.trim(), qty: 1, unit: '1人前',
      kcal: +manual.kcal || 0, protein: +manual.protein || 0,
      fat: +manual.fat || 0, carbs: +manual.carbs || 0, source: 'manual'
    });
    toast('追加しました');
    onAdded();
    onClose();
  };

  // 写真を選択 → プレビュー（まだ解析しない）
  const onPhoto = async (file: File) => {
    setPhotoError(null);
    try {
      const dataUrl = await compress(file, 1024);
      setPhotoDataUrl(dataUrl);
    } catch (e: any) {
      setPhotoError({ stage: 'client', detail: `画像読み込みエラー: ${e?.message || String(e)}` });
    }
  };

  // 「解析する」ボタン → 実際に AI を呼ぶ
  const analyzePhotoNow = async () => {
    if (!photoDataUrl) return;
    setPhotoLoading(true);
    setPhotoError(null);
    try {
      const res = await fetch('/api/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photoDataUrl, hint: photoHint.trim() || undefined })
      });
      const data = await res.json();
      if (!data.items?.length) {
        if (data.diagnostic) {
          setPhotoError(data.diagnostic);
          toast(`解析失敗: ${data.diagnostic.detail.slice(0, 40)}…`);
        } else {
          toast('検出できませんでした');
        }
        return;
      }
      for (const it of data.items) {
        await storage.addMeal({
          date: date, meal: slot,
          name: it.name, qty: it.qty || 1, unit: it.unit || '1人前',
          kcal: it.kcal || 0, protein: it.protein || 0, fat: it.fat || 0, carbs: it.carbs || 0, source: 'photo'
        });
      }
      toast(`${data.items.length}件を追加`);
      // 状態リセット
      setPhotoDataUrl(null);
      setPhotoHint('');
      onAdded();
      onClose();
    } catch (e: any) {
      setPhotoError({ stage: 'client', detail: `クライアントエラー: ${e?.message || String(e)}` });
      toast('AI解析に失敗');
    } finally {
      setPhotoLoading(false);
    }
  };

  return (
    <Modal open={!!slot} onClose={onClose} title={`${MEAL_LABELS[slot]}に追加`}>
      {/* 戻るボタン（home以外） */}
      {!selected && tab !== 'home' && (
        <button
          onClick={() => setTab('home')}
          className="text-xs text-ink-dim hover:text-ink flex items-center gap-1 mb-3"
        >
          <ChevronLeft className="w-4 h-4" /> 戻る
        </button>
      )}

      {/* 🏠 ホーム：ボタン中心レイアウト */}
      {!selected && tab === 'home' && (
        <div className="space-y-3">
          {/* 主要操作：写真AI + 履歴 */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTab('photo')}
              className="bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 transition shadow-card"
            >
              <Camera className="w-8 h-8" />
              <div className="text-sm font-bold">写真AI</div>
              <div className="text-[10px] opacity-90 text-center leading-tight">撮影 or<br/>アルバムから</div>
            </button>
            <button
              onClick={() => setTab('search')}
              className="bg-white border-2 border-brand-200 rounded-2xl p-4 flex flex-col items-center gap-2 active:scale-95 active:bg-brand-50 transition"
            >
              <Search className="w-8 h-8 text-brand-500" />
              <div className="text-sm font-bold">検索</div>
              <div className="text-[10px] text-ink-mute text-center leading-tight">食品DBから<br/>検索</div>
            </button>
          </div>

          {/* 履歴：直近20件をワンタップで追加 */}
          {history.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-4 h-4 text-ink-mute" />
                <h3 className="text-xs font-bold text-ink-dim">最近食べたもの</h3>
                <div className="text-[10px] text-ink-mute">タップで追加</div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-[42vh] overflow-y-auto -mx-1 px-1">
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => addFromHistory(h)}
                    className="bg-surface-alt active:bg-ink-line/40 hover:bg-ink-line/30 rounded-xl p-2.5 text-left transition"
                  >
                    <div className="text-xs font-bold truncate">{h.name}</div>
                    <div className="text-[10px] text-ink-mute mt-0.5">{h.kcal}kcal</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI入力（下部） */}
          <button
            onClick={() => setTab('manual')}
            className="w-full text-xs text-brand-600 hover:text-brand-700 flex items-center justify-center gap-1.5 py-2 font-bold"
          >
            <Sparkles className="w-3.5 h-3.5" /> 食品名を入力してAI推定
          </button>
        </div>
      )}

      {/* 検索 */}
      {!selected && tab === 'search' && (
        <>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
            <input
              className="input pl-10"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="食品を検索"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1 mb-2 [scrollbar-width:none]">
            {FOOD_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`shrink-0 chip text-xs ${cat === c ? 'chip-active' : ''}`}
              >{c}</button>
            ))}
          </div>

          {history.length > 0 && query === '' && (
            <div className="mb-3">
              <div className="text-[10px] font-bold text-ink-mute mb-1">最近の記録</div>
              <div className="flex flex-wrap gap-1">
                {history.map((h, i) => (
                  <button key={i} className="chip text-xs" onClick={() => addFromHistory(h)}>{h.name}</button>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-[40vh] overflow-y-auto -mx-1">
            {results.length === 0 ? (
              <div className="text-center py-6 text-ink-mute text-sm">該当なし</div>
            ) : (
              results.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setSelected(f); setQty(1); }}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-surface-alt transition border-b border-ink-line last:border-0"
                >
                  <div className="text-sm font-semibold">{f.name}</div>
                  <div className="text-[10px] text-ink-mute mt-0.5">
                    {f.kcal} kcal · P {f.protein}g · F {f.fat}g · C {f.carbs}g · {f.unit}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {/* 写真 */}
      {!selected && tab === 'photo' && (
        <div className="py-6">
          {!photoDataUrl ? (
            // ステップ1: 写真がまだ選択されていない
            <>
              <div className="text-center">
                <Camera className="w-12 h-12 text-brand-500 mx-auto mb-3" />
                <p className="text-sm text-ink-dim mb-4">食事の写真を撮影 or 選択してください。<br />選択後にヒント文字も追加できます。</p>
              </div>
              <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ''; }} />
              <button onClick={() => photoRef.current?.click()} className="btn-primary w-full">
                <Camera className="w-4 h-4" /> 写真を選択
              </button>
            </>
          ) : (
            // ステップ2: 写真選択後 → プレビュー + ヒント編集 + 解析ボタン
            <>
              <div className="rounded-xl overflow-hidden mb-3 bg-surface-alt">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoDataUrl} alt="選択された食事" className="w-full max-h-64 object-contain" />
              </div>

              <div className="mb-3">
                <label className="label text-[11px]">料理名のヒント（任意・精度UP）</label>
                <input
                  className="input"
                  type="text"
                  value={photoHint}
                  onChange={(e) => setPhotoHint(e.target.value)}
                  placeholder="例: ラーメン二郎系、コンビニ唐揚げ弁当"
                  disabled={photoLoading}
                  autoFocus
                />
                <p className="text-[10px] text-ink-mute mt-1">商品名・料理名・量を伝えると精度が大幅にアップします</p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setPhotoDataUrl(null); setPhotoError(null); }}
                  disabled={photoLoading}
                  className="btn-secondary flex-1"
                >
                  写真を変更
                </button>
                <button
                  onClick={analyzePhotoNow}
                  disabled={photoLoading}
                  className="btn-primary flex-[2]"
                >
                  {photoLoading ? <><span className="spinner" /> 解析中...</> : <>✨ AIで解析する</>}
                </button>
              </div>
            </>
          )}

          {photoError && (
            <div className="mt-4 text-left bg-rose-50 border border-rose-200 rounded-lg p-3">
              <div className="text-xs font-bold text-rose-700 mb-1">
                {photoError.stage === 'no_food_detected' ? '食品が見つかりませんでした' : '解析できませんでした'}
              </div>
              <div className="text-[11px] text-rose-600 leading-relaxed whitespace-pre-wrap break-all">{photoError.detail}</div>
              <div className="text-[10px] text-rose-400 mt-1">原因コード: {photoError.stage}</div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setPhotoError(null); setTab('manual'); }}
                  className="text-[11px] text-rose-700 underline"
                >AIテキスト入力に切り替える</button>
                <button
                  onClick={runAiDiag}
                  className="text-[11px] text-brand-700 underline"
                >AI診断を実行</button>
              </div>
            </div>
          )}

          {/* AI診断ボタン（常時表示） */}
          <div className="mt-3">
            <button
              onClick={runAiDiag}
              disabled={diagLoading}
              className="text-[11px] text-ink-mute underline disabled:opacity-50"
            >
              {diagLoading ? '診断中...' : 'AI接続を診断する'}
            </button>
          </div>

          {/* AI診断結果 */}
          {aiDiag && (
            <div className="mt-3 text-left bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs font-bold text-blue-800 mb-2">AI診断結果</div>
              {!aiDiag.ok ? (
                <div className="text-[11px] text-blue-700">{aiDiag.reason}</div>
              ) : (
                <>
                  <div className="text-[10px] text-blue-600 mb-1">
                    APIキー: <span className="font-mono">{aiDiag.keyPrefix}</span><br />
                    使用予定モデル: <span className="font-mono">{aiDiag.selectedModel}</span>
                  </div>
                  <table className="w-full text-[10px] mt-2">
                    <tbody>
                      {aiDiag.results?.map((r: any) => (
                        <tr key={r.model} className="border-t border-blue-100">
                          <td className="py-1 pr-2 font-mono">{r.model}</td>
                          <td className="py-1 pr-2">
                            <span className={r.ok ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                              {r.ok ? `✓ ${r.status}` : `✗ ${r.status || 'ERR'}`}
                            </span>
                          </td>
                          <td className="py-1 text-ink-mute break-all">{r.message.slice(0, 60)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-[10px] text-blue-600 mt-2">
                    ✓ が1つも無い場合 → 全モデルでクォータ超過。Google AI Studio で別プロジェクトを作るか、Billingを有効化してください。
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* AI テキスト入力 */}
      {!selected && tab === 'manual' && !aiResult && (
        <div className="space-y-3">
          <div className="text-center py-2">
            <Sparkles className="w-8 h-8 text-brand-500 mx-auto mb-2" />
            <p className="text-sm font-bold mb-1">食品名から栄養を推定</p>
            <p className="text-[11px] text-ink-mute">
              「ごつ盛りのカップ焼きそば」「鶏むね肉100g」など、<br />
              自由なテキストで入力してください
            </p>
          </div>
          <div>
            <label className="label">食品名</label>
            <input
              className="input"
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !aiLoading) runAiText(); }}
              placeholder="例: ごつ盛りのカップ焼きそば"
              autoFocus
            />
          </div>
          <button
            onClick={runAiText}
            disabled={aiLoading || !aiInput.trim()}
            className="btn-primary w-full"
          >
            {aiLoading ? <><span className="spinner" /> AIに問い合わせ中...</> : <><Sparkles className="w-4 h-4" /> AIで栄養を推定</>}
          </button>

          {aiTextError && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
              <div className="text-xs font-bold text-rose-700 mb-1">推定できませんでした</div>
              <div className="text-[11px] text-rose-600 whitespace-pre-wrap break-all">{aiTextError}</div>
              <button onClick={() => setAiTextError(null)} className="text-[11px] text-rose-700 underline mt-2">閉じる</button>
            </div>
          )}

          <div className="text-[10px] text-ink-mute text-center">
            ヒント: 商品名・料理名・量を含めるほど正確に推定されます
          </div>
        </div>
      )}

      {/* AI 推定結果の確認・調整 */}
      {!selected && tab === 'manual' && aiResult && (() => {
        const q = aiQty || 1;
        const totalKcal = Math.round(aiResult.kcal * q);
        const totalP = +(aiResult.protein * q).toFixed(1);
        const totalF = +(aiResult.fat * q).toFixed(1);
        const totalC = +(aiResult.carbs * q).toFixed(1);
        return (
          <div className="space-y-3">
            {/* 推定結果ヘッダー */}
            <div className="bg-brand-50 border border-brand-100 rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-[10px] text-brand-700 font-bold mb-1">
                <Sparkles className="w-3 h-3" /> AI推定結果
              </div>
              <div className="text-base font-bold">{aiResult.name}</div>
              <div className="text-[11px] text-ink-mute mt-0.5">{aiResult.unitDesc} あたり: {aiResult.kcal}kcal · P{aiResult.protein} F{aiResult.fat} C{aiResult.carbs}</div>
            </div>

            {/* 個数調整 */}
            <div>
              <label className="label">個数（{aiResult.unitDesc}）</label>
              <div className="flex items-center gap-2 mb-2">
                <button className="btn-secondary !min-h-[44px] !px-3" onClick={() => setAiQty(Math.max(0.5, +(q - 0.5).toFixed(1)))}>
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  className="input text-center text-lg font-bold"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={q}
                  onChange={(e) => setAiQty(+e.target.value || 0)}
                />
                <button className="btn-secondary !min-h-[44px] !px-3" onClick={() => setAiQty(+(q + 0.5).toFixed(1))}>
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[10px] text-ink-mute text-right">= {Math.round(aiResult.unitG * q)}g 相当</div>
            </div>

            {/* 合計栄養値 */}
            <div className="bg-surface-alt rounded-xl p-3 grid grid-cols-4 gap-2 text-center">
              <Stat label="kcal" value={totalKcal} />
              <Stat label="P" value={totalP} />
              <Stat label="F" value={totalF} />
              <Stat label="C" value={totalC} />
            </div>

            <div className="text-[10px] text-ink-mute text-center">
              数値はAI推定です。明らかに違う場合は別の食品名で再検索してください。
            </div>

            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => { setAiResult(null); setAiQty(1); }}>
                戻る
              </button>
              <button className="btn-primary flex-1" onClick={saveAiResult}>
                追加する
              </button>
            </div>
          </div>
        );
      })()}

      {/* 選択された食品の量調整 */}
      {selected && scaled && (() => {
        // 個数が自然な単位（個・枚・杯・玉・切れ・本・串・尾）かを判定
        const isPieceUnit = /(?:個|枚|杯|玉|切れ|本|串|尾)/.test(selected.unit);
        const grams = +(qty * selected.unitG).toFixed(0);
        const setGrams = (g: number) => setQty(+((Math.max(0, g)) / selected.unitG).toFixed(2));

        return (
          <div>
            <div className="font-bold mb-1">{selected.name}</div>
            <div className="text-xs text-ink-dim mb-3">
              {selected.unit} あたり: {selected.kcal}kcal · P{selected.protein} F{selected.fat} C{selected.carbs}
            </div>

            {isPieceUnit ? (
              // 個数入力モード
              <>
                <label className="label">個数（{selected.unit}）</label>
                <div className="flex items-center gap-2 mb-2">
                  <button className="btn-secondary !min-h-[44px] !px-3" onClick={() => setQty(Math.max(0.5, +(qty - 0.5).toFixed(1)))}>
                    <Minus className="w-4 h-4" />
                  </button>
                  <input className="input text-center text-lg font-bold" type="number" inputMode="decimal" step="0.5" value={qty} onChange={(e) => setQty(+e.target.value || 0)} />
                  <button className="btn-secondary !min-h-[44px] !px-3" onClick={() => setQty(+(qty + 0.5).toFixed(1))}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[10px] text-ink-mute text-right mb-4">= {grams}g 相当</div>
              </>
            ) : (
              // グラム入力モード（基本）
              <>
                <label className="label">量（グラム）</label>
                <div className="flex items-center gap-2 mb-2">
                  <button className="btn-secondary !min-h-[44px] !px-3" onClick={() => setGrams(grams - 10)}>
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex-1 relative">
                    <input
                      className="input text-center text-lg font-bold pr-8"
                      type="number"
                      inputMode="numeric"
                      step="1"
                      value={grams}
                      onChange={(e) => setGrams(+e.target.value || 0)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-mute font-bold pointer-events-none">g</span>
                  </div>
                  <button className="btn-secondary !min-h-[44px] !px-3" onClick={() => setGrams(grams + 10)}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {/* よく使う g クイック追加 */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {[50, 100, 150, 200].map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrams(g)}
                      className="text-[11px] py-1.5 rounded-md bg-surface-alt hover:bg-ink-line/30 active:bg-ink-line/50 font-bold text-ink-dim transition"
                    >{g}g</button>
                  ))}
                </div>
              </>
            )}

            <div className="bg-surface-alt rounded-xl p-3 mb-4 grid grid-cols-4 gap-2 text-center">
              <Stat label="kcal" value={scaled.kcal} />
              <Stat label="P" value={scaled.protein} />
              <Stat label="F" value={scaled.fat} />
              <Stat label="C" value={scaled.carbs} />
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => setSelected(null)}>戻る</button>
              <button className="btn-primary flex-1" onClick={addFood}>追加する</button>
            </div>
          </div>
        );
      })()}
    </Modal>
  );
}

/* ---------- 上部の週カレンダー（添付画像風：月名+前後週ナビ+達成リング） ---------- */
function shiftDateStr(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function WeekCalendar({
  selectedDate,
  onSelectDate,
  weekMeals,
  kcalTarget
}: {
  selectedDate: string;
  onSelectDate: (d: string) => void;
  weekMeals: Map<string, { kcal: number; count: number }>;
  kcalTarget: number;
}) {
  // 選択日を含む週（日曜始まり）の日付配列
  const sel = new Date(selectedDate);
  const dow = sel.getDay();
  const sunday = new Date(sel);
  sunday.setDate(sel.getDate() - dow);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  const monthLabel = `${sel.getFullYear()}年${sel.getMonth() + 1}月`;
  const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

  return (
    <div className="bg-gradient-to-b from-brand-50 to-white -mx-4 md:-mx-8 px-4 md:px-8 pt-3 pb-3 mb-3 border-b border-brand-100">
      {/* 月名 + 週ナビ */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => onSelectDate(shiftDateStr(selectedDate, -7))}
          className="p-1 text-ink-dim hover:text-ink rounded-full hover:bg-white/60 active:bg-white transition"
          aria-label="前週"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="text-sm font-bold tracking-tight">{monthLabel}</div>
        <button
          onClick={() => onSelectDate(shiftDateStr(selectedDate, 7))}
          className="p-1 text-ink-dim hover:text-ink rounded-full hover:bg-white/60 active:bg-white transition"
          aria-label="翌週"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 7日カレンダー：曜日 + 日付ボタン + 達成リング */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const dayNum = Number(d.slice(8, 10));
          const isToday = d === today;
          const isSelected = d === selectedDate;
          const summary = weekMeals.get(d);
          const pct = kcalTarget > 0 && summary ? Math.min(summary.kcal / kcalTarget, 1) : 0;
          const hasRecord = (summary?.count ?? 0) > 0;
          const isOver = summary && summary.kcal > kcalTarget * 1.1;
          const ringColor = isOver ? '#ef4444' : '#f97316'; // 超過は赤、それ以外はブランド色
          return (
            <button
              key={d}
              onClick={() => onSelectDate(d)}
              className="flex flex-col items-center py-1.5 gap-0.5 rounded-lg hover:bg-white/60 active:bg-white transition"
            >
              <div className={`text-[9px] font-bold ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-blue-500' : 'text-ink-mute'}`}>
                {WEEKDAY_LABELS[i]}
              </div>
              <div className="relative w-9 h-9">
                {/* 達成リング（SVG） */}
                {hasRecord && (
                  <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="2.5" />
                    <circle
                      cx="18" cy="18" r="15"
                      fill="none"
                      stroke={ringColor}
                      strokeWidth="2.5"
                      strokeDasharray={`${pct * 94.25} 94.25`}
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                {/* 日付テキスト */}
                <div className={`absolute inset-0 flex items-center justify-center text-sm font-bold rounded-full ${
                  isSelected ? 'bg-brand-500 text-white' :
                  isToday ? 'text-brand-600 ring-1 ring-brand-300' :
                  'text-ink'
                }`}>
                  {dayNum}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`py-2 text-xs font-bold rounded-md transition ${active ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-mute'}`}
    >{children}</button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] text-ink-mute font-bold">{label}</div>
      <div className="text-base font-bold">{value}</div>
    </div>
  );
}

function compress(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = h * (maxDim / w); w = maxDim; }
        else if (h > maxDim) { w = w * (maxDim / h); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
