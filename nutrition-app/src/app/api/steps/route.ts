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

  if (date) {
    const s = await prisma.steps.findUnique({ where: { userId_date: { userId: user.id, date } } });
    return NextResponse.json(s || null);
  }
  if (from && to) {
    const all = await prisma.steps.findMany({
      where: { userId: user.id, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' }
    });
    return NextResponse.json(all);
  }
  const all = await prisma.steps.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    take: 30
  });
  return NextResponse.json(all);
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { date, count } = await req.json().catch(() => ({}));
  if (!date || count == null) return NextResponse.json({ error: 'date, count required' }, { status: 400 });
  const row = await prisma.steps.upsert({
    where: { userId_date: { userId: user.id, date: String(date) } },
    create: { userId: user.id, date: String(date), count: Number(count), source: 'manual' },
    update: { count: Number(count), source: 'manual' }
  });
  return NextResponse.json(row);
}
