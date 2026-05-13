// 種目別グルーピング — 同じ日・同じ部位・同じ種目のセットを集約
import { setVolume, estimate1RM } from './training';

export interface ExerciseSummary {
  bodyPart: string;
  exercise: string;
  workoutIds: string[];          // このグループに含まれる Workout の ID 群
  sets: Array<{
    id?: string;                 // StrengthSet.id（サーバー時）
    workoutId: string;
    bodyPart: string;
    exercise: string;
    setNumber: number;
    weight: number | null;
    reps: number | null;
  }>;
  totalVolume: number;
  maxRM: number;
  memo?: string | null;
}

export interface CardioSummary {
  workoutId: string;
  cardioName: string;
  durationMin: number | null;
  distanceKm: number | null;
  kcal: number | null;
  memo: string | null;
}

export interface DayGroups {
  exercises: ExerciseSummary[];
  cardios: CardioSummary[];
  totalExercises: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  totalKcal: number;
}

/**
 * 同じ日の workouts を「種目」単位に集約
 */
export function groupDayWorkouts(workouts: any[]): DayGroups {
  const exMap = new Map<string, ExerciseSummary>();
  const cardios: CardioSummary[] = [];

  for (const w of workouts) {
    if (w.type === 'cardio') {
      cardios.push({
        workoutId: w.id,
        cardioName: w.cardioName || '有酸素',
        durationMin: w.durationMin ?? null,
        distanceKm: w.distanceKm ?? null,
        kcal: w.kcal ?? null,
        memo: w.memo ?? null
      });
      continue;
    }
    if (w.type === 'strength' && Array.isArray(w.sets)) {
      for (const s of w.sets) {
        const key = `${s.bodyPart}-${s.exercise}`;
        if (!exMap.has(key)) {
          exMap.set(key, {
            bodyPart: s.bodyPart,
            exercise: s.exercise,
            workoutIds: [w.id],
            sets: [],
            totalVolume: 0,
            maxRM: 0,
            memo: w.memo
          });
        }
        const g = exMap.get(key)!;
        if (!g.workoutIds.includes(w.id)) g.workoutIds.push(w.id);
        g.sets.push({
          id: s.id,
          workoutId: w.id,
          bodyPart: s.bodyPart,
          exercise: s.exercise,
          setNumber: g.sets.length + 1, // 表示用の連番に振り直し
          weight: s.weight ?? null,
          reps: s.reps ?? null
        });
      }
    }
  }

  // 集計
  const exercises = Array.from(exMap.values()).map((g) => {
    const totalVolume = g.sets.reduce((s, st) => s + setVolume(st.weight, st.reps), 0);
    const maxRM = g.sets.reduce((mx, st) => Math.max(mx, estimate1RM(st.weight, st.reps)), 0);
    return { ...g, totalVolume, maxRM };
  });

  const totalSets = exercises.reduce((s, g) => s + g.sets.length, 0);
  const totalReps = exercises.reduce((s, g) => s + g.sets.reduce((a, st) => a + (st.reps || 0), 0), 0);
  const totalVolume = exercises.reduce((s, g) => s + g.totalVolume, 0);
  const totalKcal = workouts.reduce((s, w) => s + (w.kcal || 0), 0);

  return {
    exercises,
    cardios,
    totalExercises: exercises.length + cardios.length,
    totalSets,
    totalReps,
    totalVolume,
    totalKcal
  };
}

/**
 * カレンダー上で1日に表示する種目名サマリー（最大3つ）
 */
export function dayExerciseLabels(workouts: any[]): string[] {
  const groups = groupDayWorkouts(workouts);
  const labels: string[] = [];
  for (const ex of groups.exercises) labels.push(ex.exercise);
  for (const c of groups.cardios) labels.push(c.cardioName);
  return labels;
}
