import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const date = sp.get('date');
  const from = sp.get('from');
  const to = sp.get('to');
  const recent = sp.get('recent');

  if (date) {
    const ws = await prisma.workout.findMany({
      where: { userId: user.id, date },
      orderBy: { createdAt: 'asc' },
      include: { sets: { orderBy: { setNumber: 'asc' } } }
    });
    return NextResponse.json(ws);
  }
  if (from && to) {
    const ws = await prisma.workout.findMany({
      where: { userId: user.id, date: { gte: from, lte: to } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: { sets: { orderBy: { setNumber: 'asc' } } }
    });
    return NextResponse.json(ws);
  }
  if (recent) {
    const ws = await prisma.workout.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(recent) || 30, 100),
      include: { sets: { orderBy: { setNumber: 'asc' } } }
    });
    return NextResponse.json(ws);
  }
  return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.date || !body.type) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

  const created = await prisma.workout.create({
    data: {
      userId: user.id,
      date: String(body.date),
      type: body.type === 'cardio' ? 'cardio' : 'strength',
      cardioName: body.cardioName || null,
      durationMin: body.durationMin != null ? Number(body.durationMin) : null,
      distanceKm: body.distanceKm != null ? Number(body.distanceKm) : null,
      kcal: body.kcal != null ? Number(body.kcal) : null,
      memo: body.memo ? String(body.memo).slice(0, 1000) : null,
      sets: body.type === 'strength' && Array.isArray(body.sets) ? {
        create: body.sets.map((s: any, i: number) => ({
          bodyPart: String(s.bodyPart || 'other'),
          exercise: String(s.exercise || ''),
          setNumber: Number(s.setNumber) || i + 1,
          weight: s.weight != null ? Number(s.weight) : null,
          reps: s.reps != null ? Number(s.reps) : null
        }))
      } : undefined
    },
    include: { sets: true }
  });
  return NextResponse.json(created);
}
