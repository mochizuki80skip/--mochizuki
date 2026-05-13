import { redirect } from 'next/navigation';
import { getCurrentTrainer } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminShell } from './admin-shell';
import Link from 'next/link';
import { Users, UserPlus, ListTodo, Activity } from 'lucide-react';
import { todayStr, daysAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const trainer = await getCurrentTrainer();
  if (!trainer) redirect('/admin/login');

  const today = todayStr();
  const last7 = daysAgo(7);

  const [memberCount, userCount, leadCount, todayActiveUsers, recentMeals, recentMembers] = await Promise.all([
    prisma.user.count({ where: { isMember: true } }),
    prisma.user.count({ where: { isMember: false, onboardedAt: { not: null } } }),
    prisma.user.count({ where: { isMember: false, onboardedAt: null } }),
    prisma.meal.findMany({
      where: { date: today },
      distinct: ['userId'],
      select: { userId: true }
    }),
    prisma.meal.findMany({
      where: { date: { gte: last7 } },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { user: { select: { displayName: true, isMember: true, pictureUrl: true } } }
    }),
    prisma.user.findMany({
      where: { isMember: true },
      orderBy: { memberSince: 'desc' },
      take: 5,
      select: { id: true, displayName: true, pictureUrl: true, memberSince: true, lastSeenAt: true }
    })
  ]);

  return (
    <AdminShell trainer={trainer}>
      <h1 className="text-2xl font-bold mb-1">ダッシュボード</h1>
      <p className="text-ink-dim text-sm mb-6">こんにちは、{trainer.displayName} さん</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="ONE'S BODY 会員" value={memberCount} icon={<Users />} color="bg-brand-50 text-brand-600" href="/admin/members" />
        <StatCard label="一般ユーザー" value={userCount} icon={<UserPlus />} color="bg-blue-50 text-blue-600" href="/admin/users" />
        <StatCard label="見込み客" value={leadCount} icon={<ListTodo />} color="bg-green-50 text-green-600" href="/admin/leads" />
        <StatCard label="今日のアクティブ" value={todayActiveUsers.length} icon={<Activity />} color="bg-purple-50 text-purple-600" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-4">
          <h2 className="font-bold text-base mb-3">最新の食事ログ</h2>
          {recentMeals.length === 0 ? (
            <div className="text-sm text-ink-mute py-6 text-center">まだ記録がありません</div>
          ) : (
            <div className="-my-2">
              {recentMeals.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2 border-b border-ink-line last:border-0">
                  <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600 shrink-0">
                    {m.user.displayName.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {m.user.displayName}
                      {m.user.isMember && <span className="ml-1 text-[10px] text-brand-600">●会員</span>}
                    </div>
                    <div className="text-xs text-ink-mute truncate">{m.name} · {m.kcal}kcal</div>
                  </div>
                  <div className="text-[10px] text-ink-mute">{m.date}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-base">最近の会員</h2>
            <Link href="/admin/members" className="text-xs text-brand-600 font-bold">すべて</Link>
          </div>
          {recentMembers.length === 0 ? (
            <div className="text-sm text-ink-mute py-6 text-center">会員はまだいません</div>
          ) : (
            <div className="-my-2">
              {recentMembers.map((u) => (
                <Link key={u.id} href={`/admin/members/${u.id}`} className="flex items-center gap-3 py-2 border-b border-ink-line last:border-0 hover:bg-surface-alt -mx-2 px-2 rounded">
                  <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {u.displayName.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{u.displayName}</div>
                    <div className="text-xs text-ink-mute">入会: {u.memberSince ? new Date(u.memberSince).toLocaleDateString('ja-JP') : '—'}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function StatCard({ label, value, icon, color, href }: { label: string; value: number; icon: React.ReactNode; color: string; href?: string }) {
  const inner = (
    <div className="bg-white rounded-2xl shadow-card p-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${color}`}>
        {icon}
      </div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-ink-dim mt-1">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
