import { notFound, redirect } from 'next/navigation';
import { getCurrentTrainer } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '../../admin-shell';
import { calcTargets, sumDay, sumByMeal, GOAL_PRESETS } from '@/lib/nutrition';
import { todayStr, daysAgo } from '@/lib/utils';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { MemberDetailView } from './detail-view';

export const dynamic = 'force-dynamic';

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trainer = await getCurrentTrainer();
  if (!trainer) redirect('/admin/login');

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) notFound();

  const today = todayStr();
  const last30 = daysAgo(30);

  const [todayMeals, recentMeals, weights, comments] = await Promise.all([
    prisma.meal.findMany({ where: { userId: id, date: today }, orderBy: { createdAt: 'asc' } }),
    prisma.meal.findMany({ where: { userId: id, date: { gte: last30 } }, orderBy: [{ date: 'desc' }, { createdAt: 'asc' }] }),
    prisma.weight.findMany({ where: { userId: id }, orderBy: { date: 'asc' } }),
    prisma.trainerComment.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      include: { trainer: { select: { displayName: true, pictureUrl: true } } }
    })
  ]);

  const targets = calcTargets(user);
  const todaySum = sumDay(todayMeals);

  // Aggregate by date for trends
  const byDate: Record<string, any> = {};
  for (const m of recentMeals) {
    const d = byDate[m.date] = byDate[m.date] || { date: m.date, kcal: 0, protein: 0, fat: 0, carbs: 0, count: 0 };
    d.kcal += m.kcal; d.protein += m.protein; d.fat += m.fat; d.carbs += m.carbs; d.count++;
  }
  const dailyTotals = Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));

  return (
    <AdminShell trainer={trainer}>
      <Link href="/admin/members" className="inline-flex items-center gap-1 text-sm text-ink-dim hover:text-ink mb-3">
        <ArrowLeft className="w-4 h-4" /> 会員一覧に戻る
      </Link>
      <MemberDetailView
        user={{
          id: user.id,
          displayName: user.displayName,
          pictureUrl: user.pictureUrl,
          memberCode: user.memberCode,
          memberSince: user.memberSince ? user.memberSince.toISOString() : null,
          sex: user.sex,
          age: user.age,
          heightCm: user.heightCm,
          weightKg: user.weightKg,
          targetWeight: user.targetWeight,
          activity: user.activity,
          goal: user.goal,
          goalLabel: user.goal ? GOAL_PRESETS[user.goal]?.label : null
        }}
        targets={targets}
        todaySum={todaySum}
        todayMeals={todayMeals}
        weights={weights}
        dailyTotals={dailyTotals as any}
        comments={comments.map((c) => ({
          id: c.id,
          content: c.content,
          date: c.date,
          createdAt: c.createdAt.toISOString(),
          trainer: c.trainer
        }))}
      />
    </AdminShell>
  );
}
