// 目標・プラン生成ロジック
import type { Targets } from './nutrition';
import { calcTargets, GOAL_PRESETS } from './nutrition';

export interface GoalPlan {
  // 目標
  goalType: 'diet' | 'bulk' | 'bodymake' | 'log';
  goalLabel: string;
  startWeight: number;
  targetWeight: number;
  startedAt: string; // ISO date
  deadline: string;  // ISO date
  // 週次ペース
  weeklyKg: number;
  // 日次栄養
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  // 補助情報
  weeksTotal: number;
  // 運動の組み合わせ
  useExercise: boolean;
  weeklyFreq: number;       // 週運動回数（運動ありの場合）
  exerciseKcalPerDay: number; // 1日あたりの運動消費kcal（日割り）
}

export interface GoalProgressInput {
  plan: GoalPlan;
  weights: { date: string; weight: number }[]; // ascending
  todayStr: string;
}

export interface GoalProgress {
  daysElapsed: number;
  daysTotal: number;
  daysRemaining: number;
  weightDelta: number;        // start からの変化量 (kg)
  expectedDelta: number;      // 計画上 この時点で達成すべき変化量
  paceStatus: 'on-track' | 'ahead' | 'behind' | 'starting' | 'done';
  paceMessage: string;
  predictedFinalWeight: number; // このペースを維持した場合の最終体重
  predictedReachDate: string | null; // 現ペースで目標到達する日
  progressPct: number; // 0-100
}

const GOAL_LABELS: Record<string, string> = {
  diet: 'ダイエット',
  bulk: 'バルクアップ',
  bodymake: '体型維持',
  log: '記録のみ'
};

const PERIOD_PRESETS: Record<string, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '12m': 365
};

export function periodToDays(p: string): number {
  return PERIOD_PRESETS[p] || 90;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function diffDays(from: Date | string, to: Date | string): number {
  const f = typeof from === 'string' ? new Date(from) : from;
  const t = typeof to === 'string' ? new Date(to) : to;
  return Math.round((t.getTime() - f.getTime()) / (1000 * 60 * 60 * 24));
}

// 1回あたりの運動消費kcal（一律）
export const EXERCISE_KCAL_PER_SESSION = 250;

/**
 * 目標と期間 + 運動有無から計画を計算
 * 1kg脂肪 ≒ 7200kcal を基準にカロリー収支算出
 * 運動ありの場合: 目標摂取kcal = TDEE + 運動分(日割り) + 目標調整
 */
export function calculateBasePlan(opts: {
  goalType: 'diet' | 'bulk' | 'bodymake' | 'log';
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeight: number;
  activity: 'low' | 'mid' | 'high';
  deadline: Date;
  startedAt?: Date;
  useExercise?: boolean;
  weeklyFreq?: number;
}): GoalPlan {
  const start = opts.startedAt || new Date();
  const days = Math.max(7, diffDays(start, opts.deadline));
  const weeks = days / 7;
  const deltaKg = opts.targetWeight - opts.weightKg;
  const weeklyKg = +(deltaKg / weeks).toFixed(2);

  // 必要日次カロリー調整: 1kg脂肪 = 7200kcal
  const dailyAdjust = Math.round((deltaKg * 7200) / days);

  const targets: Targets = calcTargets({
    sex: opts.sex, age: opts.age, heightCm: opts.heightCm,
    weightKg: opts.weightKg, activity: opts.activity, goal: opts.goalType
  });

  // 運動消費を日割りで加算
  const useExercise = !!opts.useExercise && opts.goalType !== 'log';
  const weeklyFreq = useExercise ? Math.max(1, Math.min(7, opts.weeklyFreq || 3)) : 0;
  const exerciseKcalPerDay = useExercise ? Math.round((weeklyFreq * EXERCISE_KCAL_PER_SESSION) / 7) : 0;

  // 目標期間からの基本カロリー
  let kcal = Math.max(1200, targets.tdee + dailyAdjust + exerciseKcalPerDay);
  if (opts.goalType === 'log') kcal = targets.tdee; // 記録のみは維持

  // PFC比率
  const preset = GOAL_PRESETS[opts.goalType === 'log' ? 'bodymake' : opts.goalType] || GOAL_PRESETS.bodymake;
  const proteinFloor = Math.round(opts.weightKg * 1.6);
  const protein = Math.max(Math.round((kcal * preset.pRatio) / 4), proteinFloor);
  const fat = Math.round((kcal * preset.fRatio) / 9);
  const carbs = Math.round((kcal * preset.cRatio) / 4);

  return {
    goalType: opts.goalType,
    goalLabel: GOAL_LABELS[opts.goalType] || '体型維持',
    startWeight: opts.weightKg,
    targetWeight: opts.targetWeight,
    startedAt: start.toISOString().slice(0, 10),
    deadline: opts.deadline.toISOString().slice(0, 10),
    weeklyKg,
    kcal,
    protein,
    fat,
    carbs,
    weeksTotal: Math.round(weeks),
    useExercise,
    weeklyFreq,
    exerciseKcalPerDay
  };
}

/**
 * 現在の進捗を計算
 */
export function evaluateProgress({ plan, weights, todayStr }: GoalProgressInput): GoalProgress {
  const today = new Date(todayStr);
  const start = new Date(plan.startedAt);
  const end = new Date(plan.deadline);
  const daysTotal = diffDays(start, end);
  const daysElapsed = Math.max(0, diffDays(start, today));
  const daysRemaining = Math.max(0, daysTotal - daysElapsed);

  const lastWeight = weights.length ? weights[weights.length - 1].weight : plan.startWeight;
  const weightDelta = +(lastWeight - plan.startWeight).toFixed(2);
  const planDelta = plan.targetWeight - plan.startWeight;
  const expectedDelta = +((planDelta / daysTotal) * daysElapsed).toFixed(2);

  // ペース判定
  let paceStatus: GoalProgress['paceStatus'] = 'starting';
  let paceMessage = '記録を続けて経過を見守りましょう';
  if (plan.goalType === 'log') {
    paceStatus = 'starting';
    paceMessage = '記録モードで継続中';
  } else if (daysElapsed < 3 || weights.length < 2) {
    paceStatus = 'starting';
    paceMessage = 'スタート直後です（数日後に判定）';
  } else if (Math.abs(lastWeight - plan.targetWeight) < 0.3) {
    paceStatus = 'done';
    paceMessage = '目標達成 🎉';
  } else {
    const diff = weightDelta - expectedDelta;
    if (plan.goalType === 'diet') {
      if (diff <= -0.3) paceStatus = 'ahead';
      else if (diff >= 0.5) paceStatus = 'behind';
      else paceStatus = 'on-track';
    } else if (plan.goalType === 'bulk') {
      if (diff >= 0.3) paceStatus = 'ahead';
      else if (diff <= -0.5) paceStatus = 'behind';
      else paceStatus = 'on-track';
    } else {
      paceStatus = Math.abs(diff) < 0.5 ? 'on-track' : 'behind';
    }
    paceMessage = paceStatus === 'on-track' ? 'ペース順調' :
                  paceStatus === 'ahead' ? 'ペース先行（無理は禁物）' :
                  'ペース要調整';
  }

  // 現ペース予測
  let predictedFinalWeight = lastWeight;
  let predictedReachDate: string | null = null;
  if (weights.length >= 2 && daysElapsed > 0 && plan.goalType !== 'log') {
    const currentPaceKgPerDay = weightDelta / Math.max(1, daysElapsed);
    predictedFinalWeight = +(lastWeight + currentPaceKgPerDay * daysRemaining).toFixed(2);
    if (Math.abs(currentPaceKgPerDay) > 0.005) {
      const remainingKg = plan.targetWeight - lastWeight;
      const daysToTarget = remainingKg / currentPaceKgPerDay;
      if (daysToTarget > 0 && daysToTarget < 730) {
        const reach = addDays(today, Math.round(daysToTarget));
        predictedReachDate = reach.toISOString().slice(0, 10);
      }
    }
  }

  const progressPct = daysTotal > 0 ? Math.min(100, Math.max(0, (daysElapsed / daysTotal) * 100)) : 0;

  return {
    daysElapsed, daysTotal, daysRemaining,
    weightDelta, expectedDelta,
    paceStatus, paceMessage,
    predictedFinalWeight, predictedReachDate,
    progressPct
  };
}

/**
 * 予測曲線用のポイント生成（過去の実績 + 未来の予測）
 */
export function buildPredictionPoints(plan: GoalPlan, weights: { date: string; weight: number }[], todayStr: string) {
  const actual = weights.map((w) => ({ y: w.weight, label: w.date.slice(5), kind: 'actual' as const }));
  // 線形予測
  const future: { y: number; label: string; kind: 'predict' }[] = [];
  const today = new Date(todayStr);
  const end = new Date(plan.deadline);
  const start = new Date(plan.startedAt);
  const lastWeight = weights.length ? weights[weights.length - 1].weight : plan.startWeight;
  const daysElapsed = Math.max(1, diffDays(start, today));
  const weightDelta = lastWeight - plan.startWeight;
  const paceKgPerDay = weightDelta / daysElapsed;

  const daysRemaining = diffDays(today, end);
  const stepDays = Math.max(1, Math.floor(daysRemaining / 6));
  for (let i = stepDays; i <= daysRemaining; i += stepDays) {
    const futureDate = addDays(today, i);
    const futureWeight = +(lastWeight + paceKgPerDay * i).toFixed(2);
    future.push({ y: futureWeight, label: futureDate.toISOString().slice(5, 10), kind: 'predict' });
  }
  return { actual, future };
}
