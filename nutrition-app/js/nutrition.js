/* Nutrition calculations: BMR, TDEE, PFC targets */

const ACTIVITY_FACTORS = {
  low: 1.4,   // ほぼ座位、運動なし
  mid: 1.65,  // 立ち仕事や週2-3回運動
  high: 1.9   // 週4回以上のハードトレーニング
};

const GOAL_PRESETS = {
  diet:     { label: 'ダイエット', kcalAdj: -400, pRatio: 0.30, fRatio: 0.20, cRatio: 0.50, weeklyKg: -0.4 },
  bodymake: { label: '体型維持',   kcalAdj: 0,    pRatio: 0.25, fRatio: 0.25, cRatio: 0.50, weeklyKg: 0 },
  bulk:     { label: 'バルクアップ', kcalAdj: 300, pRatio: 0.25, fRatio: 0.22, cRatio: 0.53, weeklyKg: 0.25 }
};

// Mifflin-St Jeor
function calcBMR({ sex, age, height, weight }) {
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

function calcTDEE(profile) {
  const bmr = calcBMR(profile);
  const factor = ACTIVITY_FACTORS[profile.activity] || ACTIVITY_FACTORS.mid;
  return Math.round(bmr * factor);
}

function calcTargets(profile) {
  const tdee = calcTDEE(profile);
  const goal = GOAL_PRESETS[profile.goal] || GOAL_PRESETS.bodymake;
  const kcalTarget = Math.max(1200, tdee + goal.kcalAdj);
  const pG = Math.round((kcalTarget * goal.pRatio) / 4);
  const fG = Math.round((kcalTarget * goal.fRatio) / 9);
  const cG = Math.round((kcalTarget * goal.cRatio) / 4);
  // For active people: aim for at least 1.6 g/kg protein
  const proteinFloor = Math.round(profile.weight * 1.6);
  const protein = Math.max(pG, proteinFloor);
  return {
    bmr: calcBMR(profile),
    tdee,
    kcal: kcalTarget,
    p: protein,
    f: fG,
    c: cG,
    goal: goal.label,
    weeklyKg: goal.weeklyKg
  };
}

// Aggregate one day's meals
function sumDay(items) {
  return items.reduce((acc, it) => {
    acc.kcal += it.kcal || 0;
    acc.p += it.p || 0;
    acc.f += it.f || 0;
    acc.c += it.c || 0;
    return acc;
  }, { kcal: 0, p: 0, f: 0, c: 0 });
}

function sumByMeal(items) {
  const out = { breakfast: [], lunch: [], dinner: [], snack: [] };
  for (const it of items) (out[it.meal] || out.snack).push(it);
  return out;
}

// Scaled values when user changes amount (multiplier = amount / baseUnitG?)
// Our food entries use "per-unit". multiplier = qty (number of units, e.g., 1.5)
function scaleItem(food, qty) {
  return {
    name: food.name,
    foodId: food.id,
    qty: qty,
    unit: food.unit,
    kcal: Math.round(food.kcal * qty),
    p: +(food.p * qty).toFixed(1),
    f: +(food.f * qty).toFixed(1),
    c: +(food.c * qty).toFixed(1)
  };
}

function bmi(weight, heightCm) {
  const h = heightCm / 100;
  return +(weight / (h * h)).toFixed(1);
}

window.nutrition = {
  ACTIVITY_FACTORS, GOAL_PRESETS,
  calcBMR, calcTDEE, calcTargets,
  sumDay, sumByMeal, scaleItem, bmi
};
