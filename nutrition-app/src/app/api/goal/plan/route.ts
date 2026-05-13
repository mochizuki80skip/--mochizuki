import { NextRequest, NextResponse } from 'next/server';
import { calculateBasePlan } from '@/lib/goal';
import { generatePlan } from '@/lib/ai';

/**
 * POST /api/goal/plan
 * 入力: { goalType, targetWeight, deadline, profile? }
 * 認証なしでも動作（ゲスト時はクライアントから profile を渡す）
 * 出力: 計画一式（base + AI拡張）
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { goalType, targetWeight, deadline, profile } = body;

  if (!profile || !goalType || !deadline) {
    return NextResponse.json({ error: 'profile, goalType, deadline are required' }, { status: 400 });
  }

  const tw = goalType === 'log' ? profile.weightKg : Number(targetWeight);

  const basePlan = calculateBasePlan({
    goalType,
    sex: profile.sex,
    age: Number(profile.age),
    heightCm: Number(profile.heightCm),
    weightKg: Number(profile.weightKg),
    targetWeight: tw,
    activity: profile.activity,
    deadline: new Date(deadline)
  });

  // AI で要旨と推奨を生成（失敗時はテンプレ）
  const ai = await generatePlan({
    profile: {
      sex: profile.sex,
      age: Number(profile.age),
      heightCm: Number(profile.heightCm),
      weightKg: Number(profile.weightKg),
      targetWeight: tw,
      activity: profile.activity
    },
    goalType,
    deadline,
    daysAhead: basePlan.weeksTotal * 7,
    basePlan: {
      kcal: basePlan.kcal,
      protein: basePlan.protein,
      fat: basePlan.fat,
      carbs: basePlan.carbs,
      weeklyKg: basePlan.weeklyKg
    }
  });

  const merged = {
    ...basePlan,
    targetWeight: tw,
    recommendedFoods: ai?.recommendedFoods?.length ? ai.recommendedFoods : basePlan.recommendedFoods,
    recommendedFreq: ai?.recommendedFreq || basePlan.recommendedFreq,
    tips: ai?.tips?.length ? ai.tips : basePlan.tips
  };

  return NextResponse.json({
    plan: merged,
    summary: ai?.summary || buildFallbackSummary(merged),
    aiUsed: !!ai
  });
}

function buildFallbackSummary(p: any): string {
  if (p.goalType === 'log') {
    return `**記録モード** で開始します。気軽に毎日の食事を残していきましょう。\n目安: ${p.kcal} kcal / P${p.protein}g / F${p.fat}g / C${p.carbs}g。`;
  }
  const goalLabel = ({ diet: 'ダイエット', bulk: 'バルクアップ', bodymake: '体型維持' } as any)[p.goalType] || p.goalLabel;
  return `**${goalLabel}** で ${p.startWeight}kg → ${p.targetWeight}kg を目指します（${p.weeksTotal}週間）。\n週次ペース ${p.weeklyKg >= 0 ? '+' : ''}${p.weeklyKg}kg、1日 **${p.kcal}kcal** が目安。\n${p.recommendedFreq}`;
}
