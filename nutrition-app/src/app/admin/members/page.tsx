import { redirect } from 'next/navigation';
import { getCurrentTrainer } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '../admin-shell';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { todayStr, daysAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function MembersPage() {
  const trainer = await getCurrentTrainer();
  if (!trainer) redirect('/admin/login');

  const members = await prisma.user.findMany({
    where: { isMember: true },
    orderBy: { lastSeenAt: 'desc' },
    include: {
      _count: { select: { meals: true, weights: true } }
    }
  });

  // 最終記録日を取得
  const today = todayStr();
  const yesterday = daysAgo(1);
  const week = daysAgo(7);

  const lastMealsMap = new Map<string, string>();
  for (const m of members) {
    const lastMeal = await prisma.meal.findFirst({
      where: { userId: m.id },
      orderBy: { date: 'desc' },
      select: { date: true }
    });
    if (lastMeal) lastMealsMap.set(m.id, lastMeal.date);
  }

  return (
    <AdminShell trainer={trainer}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">ONE'S BODY 会員</h1>
          <p className="text-ink-dim text-sm mt-1">{members.length} 名</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        {members.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-ink-mute text-sm">会員はまだいません</div>
            <Link href="/admin/codes" className="text-brand-600 text-sm font-bold mt-2 inline-block">招待コードを発行</Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-alt border-b border-ink-line">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">会員</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim hidden md:table-cell">目標</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim hidden md:table-cell">体重</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">最終記録</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim hidden md:table-cell">記録数</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const lastDate = lastMealsMap.get(m.id);
                let status: { label: string; color: string };
                if (!lastDate) status = { label: '未記録', color: 'bg-gray-100 text-gray-600' };
                else if (lastDate === today) status = { label: '今日', color: 'bg-green-100 text-green-600' };
                else if (lastDate === yesterday) status = { label: '昨日', color: 'bg-blue-100 text-blue-600' };
                else if (lastDate >= week) status = { label: '1週間以内', color: 'bg-yellow-100 text-yellow-700' };
                else status = { label: '要フォロー', color: 'bg-red-100 text-red-600' };

                return (
                  <tr key={m.id} className="border-b border-ink-line last:border-0 hover:bg-surface-alt cursor-pointer">
                    <td className="px-4 py-3">
                      <Link href={`/admin/members/${m.id}`} className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                          {m.displayName.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{m.displayName}</div>
                          <div className="text-[10px] text-ink-mute">{m.memberCode}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-ink-dim">
                        {m.goal === 'diet' ? 'ダイエット' : m.goal === 'bulk' ? 'バルクアップ' : m.goal === 'bodymake' ? '体型維持' : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs">{m.weightKg ? `${m.weightKg}kg → ${m.targetWeight}kg` : '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${status.color}`}>
                        {status.label}
                      </span>
                      {lastDate && <div className="text-[10px] text-ink-mute mt-0.5">{lastDate}</div>}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-xs text-ink-dim">{m._count.meals} 食事 / {m._count.weights} 計測</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
