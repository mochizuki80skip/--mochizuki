// 個人代謝係数の学習ロジック
// 食事ログ + 運動ログ + 体重ログから「実際の代謝」を推定し、
// 以降の TDEE 予測精度を向上させる

import type { Targets } from './nutrition';

export interface MetabolismInput {
  baseTDEE: number;                                                   // 計算上のTDEE
  recentMeals: Array<{ date: string; kcal: number }>;
  recentWorkouts: Array<{ date: string; kcal: number | null }>;
  recentWeights: Array<{ date: string; weight: number }>;             // ascending
  daysWindow?: number;                                                // 評価期間（既定14日）
}

export interface MetabolismResult {
  factor: number;                  // 補正係数 (0.85〜1.15 にクランプ)
  adjustedTDEE: number;            // 補正後の TDEE
  confidence: 'low' | 'mid' | 'high';
  daysUsed: number;
  expectedDeltaKg: number;         // 計算上のkg変化
  actualDeltaKg: number;           // 実際のkg変化
  note: string;
}

const KCAL_PER_KG_FAT = 7200;

export function evaluateMetabolism(input: MetabolismInput): MetabolismResult | null {
  const win = input.daysWindow ?? 14;
  if (input.recentWeights.length < 2) {
    return {
      factor: 1.0,
      adjustedTDEE: input.baseTDEE,
      confidence: 'low',
      daysUsed: 0,
      expectedDeltaKg: 0,
      actualDeltaKg: 0,
      note: '体重記録が2件未満のため、補正なし'
    };
  }
  const wAsc = [...input.recentWeights].sort((a, b) => a.date.localeCompare(b.date));
  const first = wAsc[0];
  const last = wAsc[wAsc.length - 1];
  const firstD = new Date(first.date);
  const lastD = new Date(last.date);
  const daysUsed = Math.max(1, Math.round((lastD.getTime() - firstD.getTime()) / 86400000));
  if (daysUsed < 7) {
    return {
      factor: 1.0,
      adjustedTDEE: input.baseTDEE,
      confidence: 'low',
      daysUsed,
      expectedDeltaKg: 0,
      actualDeltaKg: +(last.weight - first.weight).toFixed(2),
      note: `${daysUsed}日分のデータ。7日以上で補正開始`
    };
  }

  // 期間内の摂取kcal合計
  const inRange = (d: string) => d >= first.date && d <= last.date;
  const sumKcal = input.recentMeals.filter((m) => inRange(m.date)).reduce((s, m) => s + (m.kcal || 0), 0);
  const sumExerciseKcal = input.recentWorkouts.filter((w) => inRange(w.date)).reduce((s, w) => s + (w.kcal || 0), 0);

  // 計算上の体重変化（1kg脂肪 = 7200kcal）
  const dailyDeficit = (sumKcal / daysUsed) - input.baseTDEE - (sumExerciseKcal / daysUsed);
  const expectedDeltaKg = +((dailyDeficit * daysUsed) / KCAL_PER_KG_FAT).toFixed(2);

  // 実際の変化
  const actualDeltaKg = +(last.weight - first.weight).toFixed(2);

  // 補正係数 = 実際 / 計算上 だが、ゼロ除算と異常値を避けるために慎重に
  let factor = 1.0;
  if (Math.abs(expectedDeltaKg) > 0.1 && Math.abs(actualDeltaKg) > 0.1) {
    factor = +(actualDeltaKg / expectedDeltaKg).toFixed(3);
  }
  // factor を 0.85〜1.15 にクランプ（個人差は±15%以内と仮定）
  factor = Math.max(0.85, Math.min(1.15, factor));

  // 補正後 TDEE: 期待より実際の減量が遅い場合 → 代謝が低い → TDEEを下方修正
  // factor が大きい(=実際が期待より多く減った)時、TDEEは大きめに（消費が多い）
  // factor が小さい(=実際の減量が遅い)時、TDEEは小さめに（消費が少ない）
  const adjustedTDEE = Math.round(input.baseTDEE * factor);

  let confidence: 'low' | 'mid' | 'high' = 'low';
  if (daysUsed >= 14 && input.recentWeights.length >= 4) confidence = 'high';
  else if (daysUsed >= 7) confidence = 'mid';

  const note = factor === 1.0
    ? '計算通りのペース'
    : factor > 1.0
      ? `期待より${Math.abs((factor - 1) * 100).toFixed(0)}%消費が多い傾向`
      : `期待より${Math.abs((1 - factor) * 100).toFixed(0)}%消費が少ない傾向`;

  return { factor, adjustedTDEE, confidence, daysUsed, expectedDeltaKg, actualDeltaKg, note };
}

/**
 * 日々の合計消費kcal（運動のみ + 推定 TDEE）
 */
export function totalDailyBurn(opts: {
  baseTDEE: number;
  metabolicFactor: number;
  exerciseKcal: number;
}): number {
  return Math.round(opts.baseTDEE * opts.metabolicFactor + opts.exerciseKcal);
}
