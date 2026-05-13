import { redirect } from 'next/navigation';
import { getCurrentTrainer } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '../admin-shell';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const trainer = await getCurrentTrainer();
  if (!trainer) redirect('/admin/login');

  // 見込み客 = LINE ログイン済みだがオンボード未完 OR 会員でない初期段階のユーザー
  const leads = await prisma.user.findMany({
    where: { isMember: false, onboardedAt: null },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <AdminShell trainer={trainer}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">見込み客</h1>
        <p className="text-ink-dim text-sm mt-1">
          {leads.length} 名 / LINE 連携したが本格的な記録未開始のユーザー（営業・フォロー対象）
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
        {leads.length === 0 ? (
          <div className="text-center py-16 text-ink-mute text-sm">該当ユーザーなし</div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-alt border-b border-ink-line">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">名前</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim hidden md:table-cell">LINE ID</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">登録日</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">最終アクセス</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((u) => (
                <tr key={u.id} className="border-b border-ink-line last:border-0 hover:bg-surface-alt">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {u.displayName.slice(0, 1)}
                      </div>
                      <div className="text-sm font-semibold">{u.displayName}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[10px] text-ink-mute font-mono">
                    {u.lineUserId.slice(0, 12)}...
                  </td>
                  <td className="px-4 py-3 text-xs">{new Date(u.createdAt).toLocaleDateString('ja-JP')}</td>
                  <td className="px-4 py-3 text-xs text-ink-dim">{new Date(u.lastSeenAt).toLocaleDateString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
