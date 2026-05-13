'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart } from '@/components/ui/LineChart';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { fmtShortDate, todayStr } from '@/lib/utils';
import { sumByMeal } from '@/lib/nutrition';
import { Send, MessageSquare, Trash2 } from 'lucide-react';

interface Props {
  user: any;
  targets: any;
  todaySum: any;
  todayMeals: any[];
  weights: any[];
  dailyTotals: any[];
  comments: any[];
}

const MEAL_LABELS: Record<string, string> = { breakfast: '朝', lunch: '昼', dinner: '夕', snack: '間食' };

export function MemberDetailView({ user, targets, todaySum, todayMeals, weights, dailyTotals, comments: initialComments }: Props) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  const byMeal = sumByMeal(todayMeals);

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/admin/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content: comment.trim() })
      });
      if (res.ok) {
        const newC = await res.json();
        setComments([newC, ...comments]);
        setComment('');
        router.refresh();
      }
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (id: string) => {
    if (!confirm('コメントを削除しますか？')) return;
    await fetch(`/api/admin/comments/${id}`, { method: 'DELETE' });
    setComments(comments.filter((c) => c.id !== id));
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center text-2xl font-bold text-white">
          {user.displayName.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{user.displayName}</h1>
          <div className="flex flex-wrap gap-2 mt-1 text-xs text-ink-dim">
            <span>{user.memberCode}</span>
            {user.memberSince && <span>· 入会: {new Date(user.memberSince).toLocaleDateString('ja-JP')}</span>}
            {user.goalLabel && <span>· 目標: <span className="text-brand-600 font-bold">{user.goalLabel}</span></span>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Today's intake */}
        <div className="bg-white rounded-2xl shadow-card p-4">
          <h2 className="font-bold text-base mb-3">本日の摂取（{todayStr()}）</h2>
          <div className="text-3xl font-bold mb-2">
            {Math.round(todaySum.kcal)}<span className="text-sm text-ink-dim font-normal ml-1">/ {targets.kcal} kcal</span>
          </div>
          <ProgressBar value={todaySum.kcal} target={targets.kcal} className="mb-4" />

          <div className="grid grid-cols-3 gap-2">
            <PfcStat label="P" value={todaySum.protein} target={targets.protein} color="text-blue-600 bg-blue-50" />
            <PfcStat label="F" value={todaySum.fat} target={targets.fat} color="text-yellow-600 bg-yellow-50" />
            <PfcStat label="C" value={todaySum.carbs} target={targets.carbs} color="text-red-600 bg-red-50" />
          </div>

          {todayMeals.length === 0 ? (
            <div className="mt-4 text-sm text-ink-mute text-center py-4">本日の記録なし</div>
          ) : (
            <div className="mt-4 space-y-2">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => {
                const items = byMeal[m];
                if (!items.length) return null;
                return (
                  <div key={m} className="border-t border-ink-line pt-2">
                    <div className="text-xs font-bold text-ink-dim mb-1">{MEAL_LABELS[m]}</div>
                    {items.map((it: any) => (
                      <div key={it.id} className="flex justify-between text-xs py-0.5">
                        <span className="truncate">{it.name}</span>
                        <span className="text-ink-mute shrink-0 ml-2">{it.kcal}kcal</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Weight chart */}
        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-base">体重推移</h2>
            <div className="text-xs text-ink-dim">目標 {user.targetWeight}kg</div>
          </div>
          {weights.length > 0 ? (
            <>
              <div className="text-3xl font-bold mb-2">
                {weights[weights.length - 1].weight}<span className="text-sm text-ink-dim font-normal ml-1">kg</span>
                {weights.length > 1 && (
                  <span className={`text-sm font-bold ml-2 ${weights[weights.length - 1].weight - weights[0].weight > 0 ? 'text-orange-500' : 'text-blue-500'}`}>
                    ({weights[weights.length - 1].weight - weights[0].weight > 0 ? '+' : ''}{(weights[weights.length - 1].weight - weights[0].weight).toFixed(1)})
                  </span>
                )}
              </div>
              <LineChart
                points={weights.map((w) => ({ y: w.weight, label: fmtShortDate(w.date) }))}
                target={user.targetWeight}
                height={200}
              />
            </>
          ) : (
            <div className="text-sm text-ink-mute text-center py-12">体重記録なし</div>
          )}
        </div>
      </div>

      {/* Daily kcal trends (30 days) */}
      <div className="bg-white rounded-2xl shadow-card p-4 mb-6">
        <h2 className="font-bold text-base mb-3">過去30日の摂取カロリー</h2>
        {dailyTotals.length > 0 ? (
          <LineChart
            points={dailyTotals.map((d: any) => ({ y: d.kcal, label: fmtShortDate(d.date) }))}
            target={targets.kcal}
            height={200}
          />
        ) : (
          <div className="text-sm text-ink-mute text-center py-8">記録なし</div>
        )}
      </div>

      {/* Trainer comments */}
      <div className="bg-white rounded-2xl shadow-card p-4">
        <h2 className="font-bold text-base mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> トレーナーコメント
        </h2>
        <div className="flex gap-2 mb-4">
          <textarea
            className="input flex-1 min-h-[60px] resize-none"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="アドバイスやフィードバックを入力（会員には次回ログイン時に表示されます）"
          />
          <button onClick={postComment} disabled={posting || !comment.trim()} className="btn-primary self-end">
            {posting ? <span className="spinner" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {comments.length === 0 ? (
          <div className="text-sm text-ink-mute text-center py-4">コメントなし</div>
        ) : (
          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3 p-3 bg-surface-alt rounded-xl">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600 shrink-0">
                  {c.trainer.displayName.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-xs font-bold">{c.trainer.displayName}</span>
                      <span className="text-[10px] text-ink-mute ml-2">{new Date(c.createdAt).toLocaleString('ja-JP')}</span>
                    </div>
                    <button onClick={() => deleteComment(c.id)} className="text-ink-mute hover:text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{c.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function PfcStat({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div className={`rounded-lg p-2 text-center ${color}`}>
      <div className="text-[10px] font-bold">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value.toFixed(0)}<span className="text-[9px] font-normal opacity-60">/{target}g</span></div>
    </div>
  );
}
