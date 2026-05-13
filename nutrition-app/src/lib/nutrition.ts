// 栄養計算ユーティリティ — Mifflin-St Jeor 式 + PFC ターゲット

export const ACTIVITY_FACTORS: Record<string, number> = {
  low: 1.4,
  mid: 1.65,
  high: 1.9
};

export interface GoalPreset {
  label: string;
  kcalAdj: number;
  pRatio: number;
  fRatio: number;
  cRatio: number;
  weeklyKg: number;
}

export const GOAL_PRESETS: Record<string, GoalPreset> = {
  diet:     { label: 'ダイエット',   kcalAdj: -400, pRatio: 0.30, fRatio: 0.20, cRatio: 0.50, weeklyKg: -0.4 },
  bodymake: { label: '体型維持',     kcalAdj: 0,    pRatio: 0.25, fRatio: 0.25, cRatio: 0.50, weeklyKg: 0 },
  bulk:     { label: 'バルクアップ', kcalAdj: 300,  pRatio: 0.25, fRatio: 0.22, cRatio: 0.53, weeklyKg: 0.25 }
};

export interface ProfileForCalc {
  sex?: string | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activity?: string | null;
  goal?: string | null;
}

export interface Targets {
  bmr: number;
  tdee: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  goalLabel: string;
  weeklyKg: number;
}

export function calcBMR(p: ProfileForCalc): number {
  if (!p.age || !p.heightCm || !p.weightKg) return 0;
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return Math.round(p.sex === 'male' ? base + 5 : base - 161);
}

export function calcTDEE(p: ProfileForCalc): number {
  const bmr = calcBMR(p);
  const factor = ACTIVITY_FACTORS[p.activity || 'mid'] || ACTIVITY_FACTORS.mid;
  return Math.round(bmr * factor);
}

export function calcTargets(p: ProfileForCalc): Targets {
  const bmr = calcBMR(p);
  const tdee = calcTDEE(p);
  const goal = GOAL_PRESETS[p.goal || 'bodymake'] || GOAL_PRESETS.bodymake;
  const kcal = Math.max(1200, tdee + goal.kcalAdj);
  const proteinFloor = Math.round((p.weightKg || 0) * 1.6);
  const protein = Math.max(Math.round((kcal * goal.pRatio) / 4), proteinFloor);
  const fat = Math.round((kcal * goal.fRatio) / 9);
  const carbs = Math.round((kcal * goal.cRatio) / 4);
  return { bmr, tdee, kcal, protein, fat, carbs, goalLabel: goal.label, weeklyKg: goal.weeklyKg };
}

export interface MealLite {
  meal: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export function sumDay(items: MealLite[]) {
  return items.reduce(
    (acc, it) => {
      acc.kcal += it.kcal || 0;
      acc.protein += it.protein || 0;
      acc.fat += it.fat || 0;
      acc.carbs += it.carbs || 0;
      return acc;
    },
    { kcal: 0, protein: 0, fat: 0, carbs: 0 }
  );
}

export function sumByMeal(items: MealLite[]) {
  const out: Record<string, MealLite[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const it of items) (out[it.meal] || out.snack).push(it);
  return out;
}

export function bmi(weight: number, heightCm: number): number {
  const h = heightCm / 100;
  return +(weight / (h * h)).toFixed(1);
}
