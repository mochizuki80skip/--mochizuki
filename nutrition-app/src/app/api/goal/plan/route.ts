import { NextRequest, NextResponse } from 'next/server';
import { calculateBasePlan } from '@/lib/goal';

/**
 * POST /api/goal/plan
 * 計画値を計算（推奨食品やTipsは含めない）
 * 入力: { goalType, targetWeight, deadline, profile, useExercise, weeklyFreq }
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { goalType, targetWeight, deadline, profile, useExercise, weeklyFreq } = body;

  if (!profile || !goalType || !deadline) {
    return NextResponse.json({ error: 'profile, goalType, deadline are required' }, { status: 400 });
  }

  const tw = goalType === 'log' ? profile.weightKg : Number(targetWeight);

  const plan = calculateBasePlan({
    goalType,
    sex: profile.sex,
    age: Number(profile.age),
    heightCm: Number(profile.heightCm),
    weightKg: Number(profile.weightKg),
    targetWeight: tw,
    activity: profile.activity,
    deadline: new Date(deadline),
    useExercise: !!useExercise,
    weeklyFreq: weeklyFreq != null ? Number(weeklyFreq) : 3
  });

  const summary = buildSummary(plan);

  return NextResponse.json({ plan, summary });
}

function buildSummary(p: any): string {
  if (p.goalType === 'log') {
    return `**記録モード** で開始します。\n気軽に毎日の食事を残していきましょう。\n目安: 1日 ${p.kcal} kcal / P${p.protein}g F${p.fat}g C${p.carbs}g`;
  }
  const label = ({ diet: 'ダイエット', bulk: 'バルクアップ', bodymake: '体型維持' } as any)[p.goalType] || p.goalLabel;
  const exerciseLine = p.useExercise
    ? `**週${p.weeklyFreq}回の運動** を組み合わせ、運動分 (+${p.exerciseKcalPerDay}kcal/日) を考慮した目標値です。`
    : '今回は **食事のみ** で達成する計画です。';
  return `**${label}** で ${p.startWeight}kg → ${p.targetWeight}kg を目指します（${p.weeksTotal}週間 / 週${p.weeklyKg >= 0 ? '+' : ''}${p.weeklyKg}kg ペース）。\n${exerciseLine}\n1日の目標は **${p.kcal} kcal**、 P${p.protein}g / F${p.fat}g / C${p.carbs}g。`;
}
