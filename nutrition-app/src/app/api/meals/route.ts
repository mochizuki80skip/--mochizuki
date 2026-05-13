import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const date = sp.get('date');
  const recent = sp.get('recent');
  const from = sp.get('from');
  const to = sp.get('to');

  if (date) {
    const meals = await prisma.meal.findMany({
      where: { userId: user.id, date },
      orderBy: { createdAt: 'asc' }
    });
    return NextResponse.json(meals);
  }
  if (recent) {
    const meals = await prisma.meal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(recent) || 30, 100)
    });
    return NextResponse.json(meals);
  }
  if (from && to) {
    const meals = await prisma.meal.findMany({
      where: { userId: user.id, date: { gte: from, lte: to } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
    });
    return NextResponse.json(meals);
  }
  return NextResponse.json([]);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.name || !body.date || !body.meal) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  }
  const created = await prisma.meal.create({
    data: {
      userId: user.id,
      date: String(body.date),
      meal: String(body.meal),
      name: String(body.name).slice(0, 80),
      qty: Number(body.qty) || 1,
      unit: String(body.unit || '1人前').slice(0, 20),
      kcal: Math.max(0, Math.round(Number(body.kcal) || 0)),
      protein: Math.max(0, +Number(body.protein || 0).toFixed(1)),
      fat: Math.max(0, +Number(body.fat || 0).toFixed(1)),
      carbs: Math.max(0, +Number(body.carbs || 0).toFixed(1)),
      source: ['manual', 'db', 'photo'].includes(body.source) ? body.source : 'manual'
    }
  });
  return NextResponse.json(created);
}
