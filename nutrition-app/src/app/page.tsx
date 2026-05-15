import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, getCurrentTrainer } from '@/lib/auth';
import { calcTargets, sumDay } from '@/lib/nutrition';
import { prisma } from '@/lib/prisma';
import { todayStr, daysAgo } from '@/lib/utils';
import { HomeView } from './home-view';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  const trainer = await getCurrentTrainer().catch(() => null);
  const sp = await searchParams;

  // LIFF からの OAuth コールバックを検出（code/state/liff. 等が含まれる）
  const hasLiffCallback = Object.keys(sp).some((k) =>
    k === 'code' || k === 'state' || k === 'liffClientId' || k.startsWith('liff.')
  );

  // ログイン必須化: 未ログインは常に /welcome へ強制リダイレクト
  if (!user) {
    if (hasLiffCallback) {
      const qs = Object.entries(sp)
        .filter(([_, v]) => v != null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(Array.isArray(v) ? v[0] : String(v))}`)
        .join('&');
      redirect('/welcome' + (qs ? '?' + qs : ''));
    }
    redirect('/welcome');
  }

  if (user && user.onboardedAt) {
    const today = todayStr();
    const meals = await prisma.meal.findMany({
      where: { userId: user.id, date: today },
      orderBy: { createdAt: 'asc' }
    });
    const weights = await prisma.weight.findMany({
      where: { userId: user.id, date: { gte: daysAgo(30) } },
      orderBy: { date: 'asc' }
    });
    const targets = calcTargets(user);
    const todaySum = sumDay(meals);
    const goalData = user.goalApproved && user.goalPlanJson ? {
      plan: JSON.parse(user.goalPlanJson),
      summary: user.goalPlanSummary
    } : null;
    return (
      <HomeView
        user={{ displayName: user.displayName, pictureUrl: user.pictureUrl, isMember: user.isMember }}
        features={{
          featExercise: user.featExercise,
          featSleep: user.featSleep,
          featWater: user.featWater,
          featSteps: user.featSteps
        }}
        profile={{
          sex: user.sex, age: user.age, heightCm: user.heightCm, weightKg: user.weightKg,
          targetWeight: user.targetWeight, activity: user.activity, goal: user.goal
        }}
        targets={targets}
        meals={meals}
        weights={weights}
        todaySum={todaySum}
        isTrainer={!!trainer}
        goalData={goalData}
      />
    );
  }

  return (
    <HomeView
      user={null} features={null} profile={null} targets={null}
      meals={null} weights={null} todaySum={null} isTrainer={false}
      goalData={null}
    />
  );
}
