import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/strength-sets/replace
 * 指定日・部位・種目のセットを全て削除して、新しいセット群で置換する。
 * body: { date: "YYYY-MM-DD", bodyPart: string, exercise: string,
 *         sets: [{ weight, reps, setNumber }], kcal?: number, memo?: string }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { date, bodyPart, exercise, sets, kcal, memo } = body || {};
  if (!date || !bodyPart || !exercise || !Array.isArray(sets)) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    // 1) 該当日の strength workout のうち、対象の (bodyPart, exercise) を含む set を全削除
    const targetWorkouts = await tx.workout.findMany({
      where: { userId: user.id, date, type: 'strength' },
      include: { sets: true }
    });

    for (const w of targetWorkouts) {
      const targetSetIds = w.sets
        .filter((s) => s.bodyPart === bodyPart && s.exercise === exercise)
        .map((s) => s.id);
      if (targetSetIds.length === 0) continue;
      await tx.strengthSet.deleteMany({ where: { id: { in: targetSetIds } } });
      // 親 workout から全 set が消えたら workout も削除
      const remain = await tx.strengthSet.count({ where: { workoutId: w.id } });
      if (remain === 0) {
        await tx.workout.delete({ where: { id: w.id } });
      }
    }

    // 2) sets が空なら（=全削除のみ）終了
    if (sets.length === 0) return;

    // 3) 新規 workout を作成して全セット投入
    await tx.workout.create({
      data: {
        userId: user.id,
        date,
        type: 'strength',
        kcal: typeof kcal === 'number' ? kcal : null,
        memo: typeof memo === 'string' && memo.length > 0 ? memo : null,
        sets: {
          create: sets.map((s: any, i: number) => ({
            bodyPart,
            exercise,
            setNumber: typeof s.setNumber === 'number' ? s.setNumber : i + 1,
            weight: s.weight != null ? Number(s.weight) : null,
            reps: s.reps != null ? Number(s.reps) : null
          }))
        }
      }
    });
  });

  return NextResponse.json({ ok: true });
}
