'use client';
import type { UserFeatures } from '@/components/layout/Navigation';

const KEY = 'om:userFeatures';

// 初期表示は全タブ表示（チラつき防止）。profile 取得後に正しい値で上書きされる。
const DEFAULT: UserFeatures = {
  featExercise: true,
  featSleep: true,
  featWater: true,
  featSteps: true
};

/**
 * features の初期値を localStorage から復元する。
 * これによって、ページ遷移時にナビゲーションのチラつき（トレーニングタブが
 * 一瞬消えて再表示される問題）を防ぐ。
 */
export function getInitialFeatures(): UserFeatures {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return DEFAULT;
    const parsed = JSON.parse(saved);
    return {
      featExercise: !!parsed.featExercise,
      featSleep: !!parsed.featSleep,
      featWater: !!parsed.featWater,
      featSteps: !!parsed.featSteps
    };
  } catch {
    return DEFAULT;
  }
}

export function saveFeatures(f: UserFeatures) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(f));
  } catch {}
}
