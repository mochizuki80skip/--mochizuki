'use client';
import { useEffect, useState, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Search, Camera, Pencil, Trash2, Plus, Minus, Sun, Moon, UtensilsCrossed, Cookie, Clock, ChevronLeft, Sparkles } from 'lucide-react';
import * as storage from '@/lib/storage';
import { searchFoods, getFood, scaleFood, FOOD_CATEGORIES, type Food } from '@/lib/foods';
import { calcTargets, sumByMeal, sumDay, type Targets } from '@/lib/nutrition';
import { todayStr, fmtDateJp } from '@/lib/utils';
import type { UserFeatures } from '@/components/layout/Navigation';

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
  const [profile, setProfile] = useState<any>(null);
  const [features, setFeatures] = useState<UserFeatures>({ featExercise: false, featSleep: false, featWater: false, featSteps: false });
  const [targets, setTargets] = useState<Targets | null>(null);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);

  // 食品追加モーダル状態
  const [addSlot, setAddSlot] = useState<MealSlot | null>(null);

  useEffect(() => {
    (async () => {
      const p = await storage.getProfile();
      if (!p || !p.sex) { window.location.href = '/onboarding'; return; }
      setProfile(p);
      setTargets(calcTargets(p));
      setFeatures({
        featExercise: !!(p as any).featExercise,
        featSleep: !!(p as any).featSleep,
        featWater: !!(p as any).featWater,
        featSteps: !!(p as any).featSteps
      });
      setTodayMeals(await storage.getMealsByDate(todayStr()));
    })();
  }, []);

  const refresh = async () => setTodayMeals(await storage.getMealsByDate(todayStr()));

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
      {/* 日付ヘッダー */}
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl md:text-2xl font-bold">食事記録</h1>
        <div className="text-sm text-ink-mute">{fmtDateJp(todayStr())}</div>
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
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{it.name}</div>
                        <div className="text-[10px] text-ink-mute">
                          {it.kcal} kcal · P {it.protein}g · F {it.fat}g · C {it.carbs}g
                        </div>
                      </div>
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
        onClose={() => setAddSlot(null)}
        onAdded={refresh}
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

function AddFoodModal({ slot, onClose, onAdded }: { slot: MealSlot | null; onClose: () => void; onAdded: () => void }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'home' | 'search' | 'photo' | 'manual'>('home');
  const [cat, setCat] = useState('すべて');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [qty, setQty] = useState(1);
  const [manual, setManual] = useState({ name: '', kcal: '', protein: '', fat: '', carbs: '' });
  const [photoLoading, setPhotoLoading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

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
      date: todayStr(), meal: slot,
      name: s.name, qty: s.qty, unit: s.unit,
      kcal: s.kcal, protein: s.protein, fat: s.fat, carbs: s.carbs, source: 'db'
    });
    toast(`${s.name} を追加`);
    onAdded();
    onClose();
  };

  const addFromHistory = async (h: any) => {
    await storage.addMeal({
      date: todayStr(), meal: slot,
      name: h.name, qty: h.qty || 1, unit: h.unit || '1人前',
      kcal: h.kcal, protein: h.protein, fat: h.fat, carbs: h.carbs, source: 'manual'
    });
    toast('再追加しました');
    onAdded();
    onClose();
  };

  const saveManual = async () => {
    if (!manual.name.trim()) return toast('食品名を入力してください');
    await storage.addMeal({
      date: todayStr(), meal: slot,
      name: manual.name.trim(), qty: 1, unit: '1人前',
      kcal: +manual.kcal || 0, protein: +manual.protein || 0,
      fat: +manual.fat || 0, carbs: +manual.carbs || 0, source: 'manual'
    });
    toast('追加しました');
    onAdded();
    onClose();
  };

  const onPhoto = async (file: File) => {
    setPhotoLoading(true);
    try {
      const dataUrl = await compress(file, 1024);
      const res = await fetch('/api/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl })
      });
      const data = await res.json();
      if (!data.items?.length) { toast('検出できませんでした'); setTab('manual'); return; }
      for (const it of data.items) {
        await storage.addMeal({
          date: todayStr(), meal: slot,
          name: it.name, qty: it.qty || 1, unit: it.unit || '1人前',
          kcal: it.kcal || 0, protein: it.protein || 0, fat: it.fat || 0, carbs: it.carbs || 0, source: 'photo'
        });
      }
      toast(`${data.items.length}件を追加`);
      onAdded();
      onClose();
    } catch {
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

          {/* 手入力（下部に控えめに） */}
          <button
            onClick={() => setTab('manual')}
            className="w-full text-xs text-ink-mute hover:text-ink-dim flex items-center justify-center gap-1.5 py-2"
          >
            <Pencil className="w-3.5 h-3.5" /> 手動で栄養素を入力
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
        <div className="text-center py-6">
          <Camera className="w-12 h-12 text-brand-500 mx-auto mb-3" />
          <p className="text-sm text-ink-dim mb-4">食事の写真を撮影 or 選択すると、AIが食品とカロリーを推定します。</p>
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ''; }} />
          <button onClick={() => photoRef.current?.click()} disabled={photoLoading} className="btn-primary w-full">
            {photoLoading ? <><span className="spinner" /> 解析中...</> : <><Camera className="w-4 h-4" /> 写真を選択</>}
          </button>
        </div>
      )}

      {/* 手入力 */}
      {!selected && tab === 'manual' && (
        <div className="space-y-3">
          <div>
            <label className="label">食品名</label>
            <input className="input" type="text" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="例: 自家製サラダ" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">カロリー (kcal)</label>
              <input className="input" type="number" inputMode="numeric" value={manual.kcal} onChange={(e) => setManual({ ...manual, kcal: e.target.value })} />
            </div>
            <div>
              <label className="label">タンパク質 (g)</label>
              <input className="input" type="number" step="0.1" value={manual.protein} onChange={(e) => setManual({ ...manual, protein: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">脂質 (g)</label>
              <input className="input" type="number" step="0.1" value={manual.fat} onChange={(e) => setManual({ ...manual, fat: e.target.value })} />
            </div>
            <div>
              <label className="label">炭水化物 (g)</label>
              <input className="input" type="number" step="0.1" value={manual.carbs} onChange={(e) => setManual({ ...manual, carbs: e.target.value })} />
            </div>
          </div>
          <button onClick={saveManual} className="btn-primary w-full">追加する</button>
        </div>
      )}

      {/* 選択された食品の量調整 */}
      {selected && scaled && (
        <div>
          <div className="font-bold mb-1">{selected.name}</div>
          <div className="text-xs text-ink-dim mb-3">
            {selected.unit} あたり: {selected.kcal}kcal · P{selected.protein} F{selected.fat} C{selected.carbs}
          </div>
          <label className="label">量（{selected.unit} の倍数）</label>
          <div className="flex items-center gap-2 mb-4">
            <button className="btn-secondary !min-h-[40px] !px-3" onClick={() => setQty(Math.max(0.1, +(qty - 0.5).toFixed(1)))}>
              <Minus className="w-4 h-4" />
            </button>
            <input className="input text-center" type="number" step="0.1" value={qty} onChange={(e) => setQty(+e.target.value || 0)} />
            <button className="btn-secondary !min-h-[40px] !px-3" onClick={() => setQty(+(qty + 0.5).toFixed(1))}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
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
      )}
    </Modal>
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
