'use client';
import { useEffect, useState, useRef } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Search, Camera, Pencil, Trash2, X, Plus, Minus } from 'lucide-react';
import * as storage from '@/lib/storage';
import { searchFoods, getFood, scaleFood, FOOD_CATEGORIES, type Food } from '@/lib/foods';
import { sumByMeal } from '@/lib/nutrition';
import { todayStr } from '@/lib/utils';

const MEAL_LABELS: Record<string, string> = { breakfast: '朝', lunch: '昼', dinner: '夕', snack: '間食' };

export default function LogPage() {
  return (
    <AppShell user={null}>
      <LogView />
    </AppShell>
  );
}

function LogView() {
  const { toast } = useToast();
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(() => {
    const h = new Date().getHours();
    return h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
  });
  const [cat, setCat] = useState('すべて');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [todayMeals, setTodayMeals] = useState<any[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // selected food modal
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [qty, setQty] = useState(1);
  // manual modal
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ name: '', kcal: '', protein: '', fat: '', carbs: '' });
  // photo
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await storage.getProfile();
      if (!p || !p.sex) { window.location.href = '/onboarding'; return; }
      setProfileLoaded(true);
      await refresh();
    })();
  }, []);

  useEffect(() => { setResults(searchFoods(query, cat)); }, [query, cat]);

  const refresh = async () => {
    setTodayMeals(await storage.getMealsByDate(todayStr()));
    setHistory((await storage.getRecentMeals(8)).slice(0, 8));
  };

  const openFood = (f: Food) => { setSelectedFood(f); setQty(1); };
  const closeFood = () => setSelectedFood(null);

  const saveFood = async () => {
    if (!selectedFood) return;
    const s = scaleFood(selectedFood, qty);
    await storage.addMeal({
      date: todayStr(),
      meal,
      name: s.name,
      qty: s.qty,
      unit: s.unit,
      kcal: s.kcal,
      protein: s.protein,
      fat: s.fat,
      carbs: s.carbs,
      source: 'db'
    });
    closeFood();
    toast(`${s.name} を追加しました`);
    await refresh();
  };

  const reAddFromHistory = async (h: any) => {
    await storage.addMeal({
      date: todayStr(),
      meal,
      name: h.name,
      qty: h.qty || 1,
      unit: h.unit || '1人前',
      kcal: h.kcal,
      protein: h.protein,
      fat: h.fat,
      carbs: h.carbs,
      source: 'manual'
    });
    toast('再追加しました');
    await refresh();
  };

  const saveManual = async () => {
    if (!manual.name.trim()) return toast('食品名を入力してください');
    await storage.addMeal({
      date: todayStr(),
      meal,
      name: manual.name.trim(),
      qty: 1,
      unit: '1人前',
      kcal: +manual.kcal || 0,
      protein: +manual.protein || 0,
      fat: +manual.fat || 0,
      carbs: +manual.carbs || 0,
      source: 'manual'
    });
    setShowManual(false);
    setManual({ name: '', kcal: '', protein: '', fat: '', carbs: '' });
    toast('追加しました');
    await refresh();
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
      if (!data.items?.length) {
        toast('検出できませんでした');
        setShowManual(true);
        return;
      }
      for (const it of data.items) {
        await storage.addMeal({
          date: todayStr(), meal,
          name: it.name, qty: it.qty || 1, unit: it.unit || '1人前',
          kcal: it.kcal || 0, protein: it.protein || 0, fat: it.fat || 0, carbs: it.carbs || 0,
          source: 'photo'
        });
      }
      toast(`${data.items.length}件を追加しました`);
      await refresh();
    } catch {
      toast('AI解析に失敗しました');
    } finally {
      setPhotoLoading(false);
    }
  };

  const del = async (id: string) => {
    await storage.deleteMeal(id);
    toast('削除しました');
    await refresh();
  };

  if (!profileLoaded) {
    return <div className="flex justify-center py-20"><span className="spinner" /></div>;
  }

  const byMeal = sumByMeal(todayMeals);
  const scaled = selectedFood ? scaleFood(selectedFood, qty) : null;

  return (
    <>
      {/* Meal selector */}
      <div className="bg-surface-alt rounded-xl p-1 grid grid-cols-4 mb-3">
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMeal(m)}
            className={`py-2 text-xs font-bold rounded-lg transition ${meal === m ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-mute'}`}
          >
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="card mb-3">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-mute" />
          <input
            className="input pl-10"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="食品を検索（鶏むね、ご飯、サラダチキン...）"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto -mx-4 px-4 pb-1 mb-3 [scrollbar-width:none]">
          {FOOD_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 chip text-xs ${cat === c ? 'chip-active' : ''}`}
            >{c}</button>
          ))}
        </div>

        <div className="flex gap-2 mb-2">
          <button className="btn-ghost flex-1" onClick={() => photoRef.current?.click()}>
            <Camera className="w-4 h-4" /> {photoLoading ? '解析中...' : '写真でAI'}
          </button>
          <button className="btn-ghost flex-1" onClick={() => setShowManual(true)}>
            <Pencil className="w-4 h-4" /> 手入力
          </button>
        </div>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = ''; }} />

        {history.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-bold text-ink-dim mb-2">最近の記録</div>
            <div className="flex flex-wrap gap-1.5">
              {history.map((h, i) => (
                <button key={i} className="chip text-xs" onClick={() => reAddFromHistory(h)}>{h.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto -mx-1">
          {results.length === 0 ? (
            <div className="text-center py-6 text-ink-mute text-sm">該当なし</div>
          ) : (
            results.map((f) => (
              <button
                key={f.id}
                onClick={() => openFood(f)}
                className="w-full text-left px-3 py-3 rounded-lg hover:bg-surface-alt active:bg-surface-alt transition border-b border-ink-line last:border-0"
              >
                <div className="text-sm font-semibold">{f.name}</div>
                <div className="text-[11px] text-ink-mute mt-0.5">{f.kcal} kcal · P {f.protein}g · F {f.fat}g · C {f.carbs}g · {f.unit}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Today's log */}
      <div className="card mb-3">
        <h2 className="font-bold text-base mb-2">今日のログ</h2>
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => {
          const items = byMeal[m];
          const kcal = items.reduce((a: number, b: any) => a + b.kcal, 0);
          return (
            <div key={m} className="mb-3 last:mb-0">
              <div className="flex justify-between items-center pb-1.5 mb-2 border-b border-ink-line">
                <span className="text-sm font-bold">{MEAL_LABELS[m]}</span>
                <span className="text-xs text-ink-dim">{kcal} kcal</span>
              </div>
              {items.length === 0 ? (
                <div className="text-xs text-ink-mute py-1">未記録</div>
              ) : (
                items.map((it: any) => (
                  <div key={it.id} className="flex items-center justify-between py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{it.name}</div>
                      <div className="text-[11px] text-ink-mute">{it.kcal} kcal · P{it.protein} F{it.fat} C{it.carbs}</div>
                    </div>
                    <button onClick={() => del(it.id)} className="ml-2 p-2 text-ink-mute hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Food add modal */}
      <Modal open={!!selectedFood} onClose={closeFood} title={selectedFood?.name}>
        {selectedFood && scaled && (
          <>
            <div className="text-xs text-ink-dim mb-3">
              {selectedFood.unit} あたり: {selectedFood.kcal}kcal · P{selectedFood.protein} F{selectedFood.fat} C{selectedFood.carbs}
            </div>
            <label className="label">量（{selectedFood.unit} の倍数）</label>
            <div className="flex items-center gap-2 mb-4">
              <button className="btn-secondary !min-h-[36px] !px-3" onClick={() => setQty(Math.max(0.1, +(qty - 0.5).toFixed(1)))}>
                <Minus className="w-4 h-4" />
              </button>
              <input className="input text-center" type="number" step="0.1" value={qty} onChange={(e) => setQty(+e.target.value || 0)} />
              <button className="btn-secondary !min-h-[36px] !px-3" onClick={() => setQty(+(qty + 0.5).toFixed(1))}>
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
              <button className="btn-secondary flex-1" onClick={closeFood}>キャンセル</button>
              <button className="btn-primary flex-1" onClick={saveFood}>{MEAL_LABELS[meal]}に追加</button>
            </div>
          </>
        )}
      </Modal>

      {/* Manual entry modal */}
      <Modal open={showManual} onClose={() => setShowManual(false)} title="手入力で追加">
        <div className="mb-3">
          <label className="label">食品名</label>
          <input className="input" type="text" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} placeholder="例: 自家製サラダ" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="label">カロリー (kcal)</label>
            <input className="input" type="number" inputMode="numeric" value={manual.kcal} onChange={(e) => setManual({ ...manual, kcal: e.target.value })} />
          </div>
          <div>
            <label className="label">タンパク質 (g)</label>
            <input className="input" type="number" step="0.1" value={manual.protein} onChange={(e) => setManual({ ...manual, protein: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">脂質 (g)</label>
            <input className="input" type="number" step="0.1" value={manual.fat} onChange={(e) => setManual({ ...manual, fat: e.target.value })} />
          </div>
          <div>
            <label className="label">炭水化物 (g)</label>
            <input className="input" type="number" step="0.1" value={manual.carbs} onChange={(e) => setManual({ ...manual, carbs: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setShowManual(false)}>キャンセル</button>
          <button className="btn-primary flex-1" onClick={saveManual}>追加</button>
        </div>
      </Modal>
    </>
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
