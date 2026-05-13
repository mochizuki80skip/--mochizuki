import { redirect } from 'next/navigation';
import { getCurrentTrainer } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '../admin-shell';

export const dynamic = 'force-dynamic';

export default async function TrainersPage() {
  const trainer = await getCurrentTrainer();
  if (!trainer) redirect('/admin/login');
  if (trainer.role !== 'owner') redirect('/admin');

  const trainers = await prisma.trainer.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { comments: true } } }
  });

  const allowlist = (process.env.TRAINER_LINE_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ownerlist = (process.env.OWNER_LINE_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <AdminShell trainer={trainer}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">トレーナー管理</h1>
        <p className="text-ink-dim text-sm mt-1">許可リスト方式（Vercel 環境変数で管理）</p>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
        <h2 className="font-bold mb-2">許可リスト（環境変数）</h2>
        <div className="text-xs text-ink-dim mb-3">
          Vercel ダッシュボード → Settings → Environment Variables で以下を編集してください。<br />
          変更後はデプロイのリビルドが必要です。
        </div>
        <div className="space-y-2">
          <CodeBlock label="OWNER_LINE_USER_IDS" value={ownerlist.length ? ownerlist.join(',') : '（未設定）'} />
          <CodeBlock label="TRAINER_LINE_USER_IDS" value={allowlist.length ? allowlist.join(',') : '（未設定）'} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
        {trainers.length === 0 ? (
          <div className="text-center py-16 text-ink-mute text-sm">登録済みトレーナーなし</div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-alt border-b border-ink-line">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">名前</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">役割</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim hidden md:table-cell">LINE ID</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim hidden md:table-cell">コメント</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">登録日</th>
              </tr>
            </thead>
            <tbody>
              {trainers.map((t) => (
                <tr key={t.id} className="border-b border-ink-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold text-white">
                        {t.displayName.slice(0, 1)}
                      </div>
                      <span className="text-sm font-semibold">{t.displayName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.role === 'owner' ? 'bg-brand-100 text-brand-600' : 'bg-blue-100 text-blue-600'}`}>
                      {t.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[10px] text-ink-mute font-mono">{t.lineUserId.slice(0, 16)}...</td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs">{t._count.comments} 件</td>
                  <td className="px-4 py-3 text-xs text-ink-dim">{new Date(t.createdAt).toLocaleDateString('ja-JP')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-ink-dim mb-1">{label}</div>
      <code className="block bg-surface-alt rounded-lg p-2 text-xs font-mono break-all">{value}</code>
    </div>
  );
}
