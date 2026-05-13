// 摂取カロリー + 個人代謝係数から日々の体重を予測
import { evaluateMetabolism } from './metabolism';
import { calcTDEE } from './nutrition';

const KCAL_PER_KG_FAT = 7200;

export interface PredictionInput {
  profile: {
    sex: 'male' | 'female';
    age: number;
    heightCm: number;
    weightKg: number;
    activity: 'low' | 'mid' | 'high';
  };
  goalDeadline: string;            // YYYY-MM-DD
  todayStr: string;
  weights: { date: string; weight: number }[]; // ascending
  meals: { date: string; kcal: number }[];     // 過去14日
  workouts: { date: string; kcal: number | null }[];
  goalKcal: number;                            // 1日の目標摂取kcal
}

export interface PredictionResult {
  /** 実績ポイント（今日以前、グラフ用） */
  actual: { date: string; y: number; label: string }[];
  /** 予測ポイント（明日以降、グラフ用） */
  predict: { date: string; y: number; label: string }[];
  /** 補正済み TDEE */
  adjustedTDEE: number;
  /** 個人代謝係数（学習結果） */
  factor: number;
  /** 信頼度 */
  confidence: 'low' | 'mid' | 'high';
  /** 説明文 */
  note: string;
}

/**
 * 摂取カロリー収支 + 代謝係数から、明日以降の体重を線形予測
 */
export function predictWeight(input: PredictionInput): PredictionResult {
  const baseTDEE = calcTDEE(input.profile);

  // 個人代謝係数を学習
  const metab = evaluateMetabolism({
    baseTDEE,
    recentMeals: input.meals,
    recentWorkouts: input.workouts,
    recentWeights: input.weights,
    daysWindow: 14
  });
  const factor = metab?.factor ?? 1.0;
  const adjustedTDEE = metab?.adjustedTDEE ?? baseTDEE;

  // 直近の運動 kcal の日平均（最近7日）
  const today = new Date(input.todayStr);
  const recent7Cut = new Date(today);
  recent7Cut.setDate(recent7Cut.getDate() - 7);
  const cutStr = recent7Cut.toISOString().slice(0, 10);
  const recent7Exercise = input.workouts.filter((w) => w.date >= cutStr);
  const avgExerciseKcal = recent7Exercise.length > 0
    ? recent7Exercise.reduce((s, w) => s + (w.kcal || 0), 0) / 7
    : 0;

  // 予想日次収支 = 摂取目標 - 補正済みTDEE - 運動消費平均
  const dailyDeficit = input.goalKcal - adjustedTDEE - avgExerciseKcal;
  const dailyWeightChange = dailyDeficit / KCAL_PER_KG_FAT;

  // 実績ポイント
  const actual = input.weights.map((w) => ({
    date: w.date,
    y: w.weight,
    label: w.date.slice(5)
  }));

  // 予測ポイント：今日(最後の実績)から目標日まで、毎週ステップ
  const lastWeight = input.weights.length > 0 ? input.weights[input.weights.length - 1].weight : input.profile.weightKg;
  const deadline = new Date(input.goalDeadline);
  const daysToDeadline = Math.max(1, Math.floor((deadline.getTime() - today.getTime()) / 86400000));

  const predict: { date: string; y: number; label: string }[] = [];
  // 起点 = 今日（実績の最後と接続するため）
  predict.push({ date: input.todayStr, y: lastWeight, label: input.todayStr.slice(5) });

  const stepDays = Math.max(7, Math.floor(daysToDeadline / 8));
  for (let i = stepDays; i <= daysToDeadline; i += stepDays) {
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + i);
    const futureWeight = +(lastWeight + dailyWeightChange * i).toFixed(2);
    predict.push({ date: futureDate.toISOString().slice(0, 10), y: futureWeight, label: futureDate.toISOString().slice(5, 10) });
  }

  const note = metab?.note || '計算開始';
  const confidence = metab?.confidence || 'low';

  return { actual, predict, adjustedTDEE, factor, confidence, note };
}
