import { getCurrentUser } from '@/lib/auth';
import { calcTargets, sumDay } from '@/lib/nutrition';
import { prisma } from '@/lib/prisma';
import { todayStr, daysAgo } from '@/lib/utils';
import { HomeView } from './home-view';

export default async function Page() {
  const user = await getCurrentUser();

  // ログイン済みかつオンボード済み → サーバーデータをレンダリング
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
        user={{
          displayName: user.displayName,
          pictureUrl: user.pictureUrl,
          isMember: user.isMember
        }}
        profile={{
          sex: user.sex, age: user.age, heightCm: user.heightCm, weightKg: user.weightKg,
          targetWeight: user.targetWeight, activity: user.activity, goal: user.goal
        }}
        targets={targets}
        meals={meals}
        weights={weights}
        todaySum={todaySum}
      />
    );
  }

  // 未ログイン or 未オンボード → クライアント側で判定
  return <HomeView user={null} profile={null} targets={null} meals={null} weights={null} todaySum={null} />;
}
