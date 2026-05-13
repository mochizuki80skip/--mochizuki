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
    const w = await prisma.water.findUnique({ where: { userId_date: { userId: user.id, date } } });
    return NextResponse.json(w || null);
  }
  if (from && to) {
    const all = await prisma.water.findMany({
      where: { userId: user.id, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' }
    });
    return NextResponse.json(all);
  }
  const all = await prisma.water.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    take: 30
  });
  return NextResponse.json(all);
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { date, ml } = await req.json().catch(() => ({}));
  if (!date || ml == null) return NextResponse.json({ error: 'date, ml required' }, { status: 400 });
  const row = await prisma.water.upsert({
    where: { userId_date: { userId: user.id, date: String(date) } },
    create: { userId: user.id, date: String(date), ml: Number(ml) },
    update: { ml: Number(ml) }
  });
  return NextResponse.json(row);
}

/** 既存合計に追加（+250ml ボタン等） */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { date, addMl } = await req.json().catch(() => ({}));
  if (!date || addMl == null) return NextResponse.json({ error: 'date, addMl required' }, { status: 400 });
  const existing = await prisma.water.findUnique({
    where: { userId_date: { userId: user.id, date: String(date) } }
  });
  const newMl = (existing?.ml || 0) + Number(addMl);
  const row = await prisma.water.upsert({
    where: { userId_date: { userId: user.id, date: String(date) } },
    create: { userId: user.id, date: String(date), ml: Math.max(0, newMl) },
    update: { ml: Math.max(0, newMl) }
  });
  return NextResponse.json(row);
}
