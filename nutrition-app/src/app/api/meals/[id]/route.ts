import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  await prisma.meal.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}

/** PATCH /api/meals/[id] — 食事の量・栄養値を更新 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const existing = await prisma.meal.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const updated = await prisma.meal.update({
    where: { id },
    data: {
      qty: typeof body.qty === 'number' ? body.qty : undefined,
      unit: typeof body.unit === 'string' ? body.unit : undefined,
      kcal: typeof body.kcal === 'number' ? Math.round(body.kcal) : undefined,
      protein: typeof body.protein === 'number' ? body.protein : undefined,
      fat: typeof body.fat === 'number' ? body.fat : undefined,
      carbs: typeof body.carbs === 'number' ? body.carbs : undefined
    }
  });

  return NextResponse.json(updated);
}
