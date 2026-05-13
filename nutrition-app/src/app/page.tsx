import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser, getCurrentTrainer } from '@/lib/auth';
import { calcTargets, sumDay } from '@/lib/nutrition';
import { prisma } from '@/lib/prisma';
import { todayStr, daysAgo } from '@/lib/utils';
import { HomeView } from './home-view';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  const trainer = await getCurrentTrainer().catch(() => null);

  // ゲスト（未ログイン）かつ「ようこそ画面」未通過なら /welcome へ
  if (!user) {
    const c = await cookies();
    if (!c.get('om_intro')) redirect('/welcome');
  }

  if (user && user.onboardedAt) {
    const today = todayStr();
    const meals = await prisma.meal.findMany({
      where: { userId: user.id, date: today },
      orderBy: { createdAt: 'asc' }
    });
    const weights = await prisma.weight.findMany({
      where: { userId: user.id, date: { gte: daysAgo(14) } },
      orderBy: { date: 'asc' }
    });
    const targets = calcTargets(user);
    const todaySum = sumDay(meals);
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
      />
    );
  }

  return (
    <HomeView
      user={null} features={null} profile={null} targets={null}
      meals={null} weights={null} todaySum={null} isTrainer={false}
    />
  );
}
