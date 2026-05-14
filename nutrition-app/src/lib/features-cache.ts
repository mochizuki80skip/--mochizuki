'use client';
import type { UserFeatures } from '@/components/layout/Navigation';

const KEY = 'om:userFeatures';

const DEFAULT: UserFeatures = {
  featExercise: false,
  featSleep: false,
  featWater: false,
  featSteps: false
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
