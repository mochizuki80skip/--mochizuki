import { redirect } from 'next/navigation';
import { getCurrentTrainer } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '../admin-shell';
import { GOAL_PRESETS } from '@/lib/nutrition';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const trainer = await getCurrentTrainer();
  if (!trainer) redirect('/admin/login');

  const users = await prisma.user.findMany({
    where: { isMember: false, onboardedAt: { not: null } },
    orderBy: { lastSeenAt: 'desc' },
    include: { _count: { select: { meals: true, weights: true } } }
  });

  return (
    <AdminShell trainer={trainer}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">一般ユーザー</h1>
        <p className="text-ink-dim text-sm mt-1">{users.length} 名 / オンボード完了済み</p>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
        {users.length === 0 ? (
          <div className="text-center py-16 text-ink-mute text-sm">該当ユーザーなし</div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-alt border-b border-ink-line">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">ユーザー</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">目標</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim hidden md:table-cell">体重</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim hidden md:table-cell">記録</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">最終アクセス</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ink-line last:border-0 hover:bg-surface-alt">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {u.displayName.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{u.displayName}</div>
                        <div className="text-[10px] text-ink-mute">{u.sex === 'male' ? '男' : '女'} / {u.age}歳</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs">
                      {u.goal ? GOAL_PRESETS[u.goal]?.label : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs">
                    {u.weightKg ? `${u.weightKg} → ${u.targetWeight}kg` : '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-ink-dim">
                    {u._count.meals}食事 / {u._count.weights}計測
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-dim">
                    {new Date(u.lastSeenAt).toLocaleDateString('ja-JP')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
