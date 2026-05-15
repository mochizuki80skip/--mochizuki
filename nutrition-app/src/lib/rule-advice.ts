// ルールベースの固定アドバイス生成（AI クウォータを消費しない）
// AI 自動呼び出しを廃止し、条件に応じた定型文を出す
import type { Targets } from './nutrition';

export interface RuleAdviceInput {
  todaySum: { kcal: number; protein: number; fat: number; carbs: number };
  targets: Targets;
  goalType?: 'diet' | 'bulk' | 'bodymake' | 'log';
  hasGoal: boolean;
  currentWeight?: number | null;
  targetWeight?: number | null;
  weeklyTrendKg?: number | null; // 直近1週間の平均変動
  currentHour?: number;
}

export function generateDailyAdvice(input: RuleAdviceInput): string {
  const { todaySum, targets, hasGoal, goalType } = input;
  const hour = input.currentHour ?? new Date().getHours();
  const kcalRatio = targets.kcal > 0 ? todaySum.kcal / targets.kcal : 0;
  const proteinRatio = targets.protein > 0 ? todaySum.protein / targets.protein : 0;

  // 目標未設定
  if (!hasGoal) {
    return '**目標を設定しましょう** ⭐\n\n目標を決めると、毎日の摂取カロリーや PFC バランスの推奨値が自動計算されます。設定画面から「目標」を選んで開始してください。';
  }

  // 朝（5〜10時）
  if (hour >= 5 && hour < 10) {
    if (todaySum.kcal === 0) {
      return '**おはようございます！** ☀️\n\n朝食をしっかり摂って、1日のエネルギーをチャージしましょう。**たんぱく質**を意識すると満腹感が長続きします。';
    }
    return `**朝食を記録しました！** 🍳\n\n現在 ${Math.round(todaySum.kcal)} kcal / 目標 ${targets.kcal} kcal。良いスタートです。残り **${targets.kcal - todaySum.kcal} kcal** を昼夜に分配しましょう。`;
  }

  // 昼（10〜15時）
  if (hour >= 10 && hour < 15) {
    if (kcalRatio < 0.2) {
      return '**昼食の時間です** 🍱\n\nまだ十分に食べていません。**1食 500〜700kcal** 程度を目安にバランス良く摂取しましょう。';
    }
    if (kcalRatio > 0.6) {
      return '**カロリー摂取がやや早めです** ⚠️\n\n現在 ${Math.round(todaySum.kcal)} kcal。夜のために残り **${targets.kcal - todaySum.kcal} kcal** を計画的に。';
    }
    return `**良いペースです** 👍\n\n現在 ${Math.round(todaySum.kcal)} kcal / ${targets.kcal} kcal。昼食を含めて、目標通りに進んでいます。`;
  }

  // 夕方〜夜（15〜22時）
  if (hour >= 15 && hour < 22) {
    if (kcalRatio < 0.5) {
      return '**夕食をしっかり摂りましょう** 🍽️\n\n摂取量が不足気味です。**たんぱく質**を中心に、不足分の **${targets.kcal - Math.round(todaySum.kcal)} kcal** をバランス良く。';
    }
    if (kcalRatio > 1.1) {
      const over = Math.round(todaySum.kcal) - targets.kcal;
      return `**カロリーオーバーです** 🚨\n\n目標を **+${over} kcal** 超過しています。${goalType === 'diet' ? '減量中なので、明日は調整しましょう。' : '夜は軽めに切り替えるのがおすすめです。'}`;
    }
    if (proteinRatio < 0.5) {
      return '**たんぱく質が不足しています** 💪\n\n鶏むね肉・卵・プロテインなどで**残り ${Math.max(0, Math.round((targets.protein - todaySum.protein) * 10) / 10)}g** を補給しましょう。';
    }
    return `**順調です！** ✨\n\n現在 ${Math.round(todaySum.kcal)} kcal / ${targets.kcal} kcal、P ${todaySum.protein}g / ${targets.protein}g。このペースを維持しましょう。`;
  }

  // 夜（22時以降〜深夜）
  if (kcalRatio < 0.7) {
    return '**今日の摂取量が少なめです** 🌙\n\n${Math.round(todaySum.kcal)} kcal / ${targets.kcal} kcal。記録漏れがないか確認してください。寝る前の食事は控えめに。';
  }
  if (kcalRatio > 1.15) {
    return `**今日はカロリーオーバー** 😅\n\n+${Math.round(todaySum.kcal) - targets.kcal} kcal。明日は意識的に調整しましょう。${goalType === 'diet' ? '週単位で見れば挽回可能です。' : ''}`;
  }
  return `**良い1日でした！** 🌟\n\n摂取 ${Math.round(todaySum.kcal)} kcal、P${todaySum.protein}g F${todaySum.fat}g C${todaySum.carbs}g。明日も継続しましょう。`;
}

// 週次アドバイス（体重ページ用）
export function generateWeeklyAdvice(input: {
  goalType?: 'diet' | 'bulk' | 'bodymake' | 'log';
  weeklyTrendKg?: number | null;
  currentWeight?: number | null;
  targetWeight?: number | null;
}): string {
  const { goalType, weeklyTrendKg, currentWeight, targetWeight } = input;

  if (currentWeight == null) {
    return '**体重を記録しましょう** ⚖️\n\n継続的に記録すると、週ごとの変化が見えてきます。毎朝、起床後・トイレ後の同じタイミングがおすすめです。';
  }

  if (weeklyTrendKg == null) {
    return '**記録を続けましょう** 📊\n\n1週間以上記録すると、変化の傾向が分かります。最初の数日はブレるので、長い目で見ることが大切です。';
  }

  const trend = weeklyTrendKg;
  const isDiet = goalType === 'diet';
  const isBulk = goalType === 'bulk';

  if (isDiet) {
    if (trend < -1) return `**減量が早すぎます** ⚠️\n\n直近1週間で **${trend.toFixed(1)} kg**。週0.5〜1kg のペースが理想です。摂取カロリーを少し戻して、筋肉量を維持しましょう。`;
    if (trend < -0.3) return `**順調に減量中** 🎯\n\n直近1週間で **${trend.toFixed(1)} kg**。良いペースです。たんぱく質をしっかり摂って筋肉を守りましょう。`;
    if (trend < 0.3) return `**横ばいです** 🔄\n\n直近1週間で **${trend.toFixed(1)} kg**。摂取カロリーをもう少し抑えるか、運動量を増やしましょう。`;
    return `**増加傾向です** 📈\n\n直近1週間で **+${trend.toFixed(1)} kg**。食事内容を見直しましょう。`;
  }

  if (isBulk) {
    if (trend > 1) return `**増量が早すぎます** ⚠️\n\n直近1週間で **+${trend.toFixed(1)} kg**。脂肪も増えやすいので、週0.3〜0.5kg ペースに抑えるのが理想です。`;
    if (trend > 0.2) return `**順調に増量中** 💪\n\n直近1週間で **+${trend.toFixed(1)} kg**。たんぱく質をしっかり、筋トレを継続しましょう。`;
    if (trend > -0.2) return `**横ばいです** 🔄\n\n直近1週間で **${trend.toFixed(1)} kg**。カロリーをもう少し増やしましょう。`;
    return `**減少傾向です** 📉\n\n直近1週間で **${trend.toFixed(1)} kg**。摂取カロリーが不足しています。`;
  }

  // bodymake / log
  if (Math.abs(trend) < 0.3) return `**体重は安定しています** ✨\n\n直近1週間で ${trend > 0 ? '+' : ''}${trend.toFixed(1)} kg。記録を続けて、必要なら目標を見直しましょう。`;
  return `**体重に変化があります** 📊\n\n直近1週間で ${trend > 0 ? '+' : ''}${trend.toFixed(1)} kg。目標と照らし合わせて方向性を確認しましょう。`;
}
