import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

/**
 * POST /api/strength-sets/replace
 * 指定日・部位・種目のセットを全て削除して、新しいセット群で置換する。
 * body: { date: "YYYY-MM-DD", bodyPart: string, exercise: string,
 *         sets: [{ weight, reps, setNumber }], kcal?: number, memo?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'unauthorized', detail: 'ログインセッションが見つかりません' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { date, bodyPart, exercise, sets, kcal, memo } = body || {};
    if (!date || !bodyPart || !exercise || !Array.isArray(sets)) {
      return NextResponse.json({
        error: 'invalid body',
        detail: `必須パラメータ不足: date=${date}, bodyPart=${bodyPart}, exercise=${exercise}, sets=${Array.isArray(sets) ? 'ok' : typeof sets}`
      }, { status: 400 });
    }

    // 1) 該当日の対象 (bodyPart, exercise) のセットIDを取得
    const targetWorkouts = await prisma.workout.findMany({
      where: { userId: user.id, date, type: 'strength' },
      include: { sets: true }
    });

    const allTargetSetIds: string[] = [];
    const workoutsToCheck = new Set<string>();
    for (const w of targetWorkouts) {
      for (const s of w.sets) {
        if (s.bodyPart === bodyPart && s.exercise === exercise) {
          allTargetSetIds.push(s.id);
          workoutsToCheck.add(w.id);
        }
      }
    }

    // 2) セット削除 + 空になった workout を削除 + 新規 workout 作成 を順次実行
    if (allTargetSetIds.length > 0) {
      await prisma.strengthSet.deleteMany({ where: { id: { in: allTargetSetIds } } });
      for (const wid of workoutsToCheck) {
        const remain = await prisma.strengthSet.count({ where: { workoutId: wid } });
        if (remain === 0) {
          await prisma.workout.delete({ where: { id: wid } }).catch(() => {});
        }
      }
    }

    if (sets.length > 0) {
      await prisma.workout.create({
        data: {
          userId: user.id,
          date,
          type: 'strength',
          kcal: typeof kcal === 'number' ? Math.round(kcal) : null,
          memo: typeof memo === 'string' && memo.length > 0 ? memo : null,
          sets: {
            create: sets.map((s: any, i: number) => ({
              bodyPart,
              exercise,
              setNumber: typeof s.setNumber === 'number' ? s.setNumber : i + 1,
              weight: s.weight != null ? Number(s.weight) : null,
              reps: s.reps != null ? Math.round(Number(s.reps)) : null
            }))
          }
        }
      });
    }

    return NextResponse.json({ ok: true, removed: allTargetSetIds.length, added: sets.length });
  } catch (e: any) {
    console.error('replace error:', e);
    return NextResponse.json({
      error: 'server',
      detail: e?.message || String(e),
      code: e?.code || null
    }, { status: 500 });
  }
}
