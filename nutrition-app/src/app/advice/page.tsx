'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Sparkles, RefreshCw } from 'lucide-react';
import * as storage from '@/lib/storage';
import { calcTargets, sumDay } from '@/lib/nutrition';
import { todayStr, daysAgo } from '@/lib/utils';

export default function AdvicePage() {
  return (
    <AppShell user={null}>
      <AdviceView />
    </AppShell>
  );
}

function AdviceView() {
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily');
  const [advice, setAdvice] = useState('');
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
  const [targets, setTargets] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [recent7, setRecent7] = useState<any[]>([]);
  const [weights, setWeights] = useState<any[]>([]);

  useEffect(() => { fetchAdvice(); /* eslint-disable-next-line */ }, [mode]);

  const fetchAdvice = async () => {
    setLoading(true);
    const p = await storage.getProfile();
    if (!p || !p.sex) { window.location.href = '/onboarding'; return; }
    setProfile(p);
    const t = calcTargets(p);
    setTargets(t);

    const meals = await storage.getMealsByDate(todayStr());
    const todaySum = sumDay(meals as any);
    setToday(todaySum);

    // Recent 7 days
    const fromDate = daysAgo(7);
    const range = await storage.getMealsRange(fromDate, todayStr());
    const byDate: Record<string, any> = {};
    for (const m of range) {
      const d = byDate[m.date] = byDate[m.date] || { date: m.date, kcal: 0, protein: 0, fat: 0, carbs: 0 };
      d.kcal += m.kcal; d.protein += m.protein; d.fat += m.fat; d.carbs += m.carbs;
    }
    const r7 = Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
    setRecent7(r7);

    const ws = (await storage.getAllWeights()).slice(-14);
    setWeights(ws);

    try {
      const res = await fetch('/api/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: p, targets: t, today: todaySum, recent7: r7, weights: ws, mode })
      });
      const data = await res.json();
      setAdvice(data.advice || '');
    } catch {
      setAdvice('アドバイスを取得できませんでした');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-surface-alt rounded-xl p-1 grid grid-cols-2 mb-3">
        {(['daily', 'weekly'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`py-2 text-sm font-bold rounded-lg transition ${mode === m ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-mute'}`}
          >{m === 'daily' ? '今日のアドバイス' : '週次レポート'}</button>
        ))}
      </div>

      <div className="card mb-3 bg-gradient-to-br from-brand-50 to-white border border-brand-100">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="font-bold">{mode === 'daily' ? '今日のアドバイス' : '週次レポート'}</div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-ink-dim text-sm py-4"><span className="spinner" /> 分析中...</div>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: formatAdvice(advice) }} />
        )}
      </div>

      {targets && (
        <div className="card mb-3">
          <h3 className="text-xs font-bold text-ink-dim mb-2">本日の収支</h3>
          <Row label="摂取カロリー" value={`${Math.round(today.kcal)} kcal`} />
          <Row label="目標カロリー" value={`${targets.kcal} kcal`} />
          <Row label="差分" value={`${(today.kcal - targets.kcal).toFixed(0)} kcal`} highlight />
          <div className="mt-2 pt-2 border-t border-ink-line">
            <Row label="P / F / C" value={`${today.protein.toFixed(1)} / ${today.fat.toFixed(1)} / ${today.carbs.toFixed(1)} g`} />
          </div>
        </div>
      )}

      <button onClick={fetchAdvice} className="btn-ghost w-full">
        <RefreshCw className="w-4 h-4" /> 再生成
      </button>
    </>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-ink-dim">{label}</span>
      <span className={`text-sm font-bold ${highlight ? 'text-brand-600' : ''}`}>{value}</span>
    </div>
  );
}

function formatAdvice(text: string): string {
  const escaped = text.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string));
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong class="text-brand-600 font-bold">$1</strong>')
                .replace(/\n/g, '<br/>');
}
