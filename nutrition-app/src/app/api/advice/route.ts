import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calcTargets, sumDay } from '@/lib/nutrition';
import { generateAdvice } from '@/lib/ai';
import { todayStr, daysAgo } from '@/lib/utils';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode: 'daily' | 'weekly' = body.mode === 'weekly' ? 'weekly' : 'daily';

  // 認証ユーザー → サーバーDBから取得
  const user = await getCurrentUser();
  if (user) {
    const targets = calcTargets(user);
    if (!targets.kcal) {
      return NextResponse.json({ advice: 'プロフィールを設定するとアドバイスが表示されます。', source: 'rule' });
    }
    const today = todayStr();
    const todayMeals = await prisma.meal.findMany({ where: { userId: user.id, date: today } });
    const recentMeals = await prisma.meal.findMany({
      where: { userId: user.id, date: { gte: daysAgo(7) } }
    });
    const weights = await prisma.weight.findMany({
      where: { userId: user.id, date: { gte: daysAgo(14) } },
      orderBy: { date: 'asc' }
    });
    const todayAgg = sumDay(todayMeals);
    const byDate: Record<string, any> = {};
    for (const m of recentMeals) {
      const d = (byDate[m.date] = byDate[m.date] || { date: m.date, kcal: 0, protein: 0, fat: 0, carbs: 0 });
      d.kcal += m.kcal; d.protein += m.protein; d.fat += m.fat; d.carbs += m.carbs;
    }
    const recent7 = Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const advice = await generateAdvice({
      profile: {
        sex: user.sex, age: user.age, heightCm: user.heightCm, weightKg: user.weightKg,
        targetWeight: user.targetWeight, activity: user.activity, goal: user.goal, isMember: user.isMember
      },
      targets, today: todayAgg, recent7: recent7 as any,
      weights: weights.map((w) => ({ date: w.date, weight: w.weight, bodyFat: w.bodyFat })),
      mode
    });
    return NextResponse.json({ advice, source: 'ai' });
  }

  // 未ログイン: クライアントから渡された data を使用
  const { profile, targets, today, recent7, weights } = body;
  if (!profile || !targets) {
    return NextResponse.json({ error: 'profile and targets required' }, { status: 400 });
  }
  const advice = await generateAdvice({
    profile: { ...profile, isMember: false },
    targets, today, recent7, weights, mode
  });
  return NextResponse.json({ advice, source: 'ai' });
}
