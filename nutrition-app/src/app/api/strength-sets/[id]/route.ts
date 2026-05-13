import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** DELETE /api/strength-sets/[id] — セット単位の削除 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  // owner 確認
  const set = await prisma.strengthSet.findUnique({
    where: { id },
    include: { workout: true }
  });
  if (!set || set.workout.userId !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  await prisma.strengthSet.delete({ where: { id } });
  // 親 workout が空になったら一緒に削除
  const remain = await prisma.strengthSet.count({ where: { workoutId: set.workoutId } });
  if (remain === 0) {
    await prisma.workout.delete({ where: { id: set.workoutId } });
  }
  return NextResponse.json({ ok: true });
}

/** PATCH /api/strength-sets/[id] — セットの重量・回数を更新 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const set = await prisma.strengthSet.findUnique({
    where: { id },
    include: { workout: true }
  });
  if (!set || set.workout.userId !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const updated = await prisma.strengthSet.update({
    where: { id },
    data: {
      weight: body.weight != null ? Number(body.weight) : undefined,
      reps: body.reps != null ? Number(body.reps) : undefined
    }
  });
  return NextResponse.json(updated);
}
