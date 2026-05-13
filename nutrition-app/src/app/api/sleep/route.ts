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
    const s = await prisma.sleep.findUnique({ where: { userId_date: { userId: user.id, date } } });
    return NextResponse.json(s || null);
  }
  if (from && to) {
    const all = await prisma.sleep.findMany({
      where: { userId: user.id, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' }
    });
    return NextResponse.json(all);
  }
  const all = await prisma.sleep.findMany({
    where: { userId: user.id },
    orderBy: { date: 'desc' },
    take: 30
  });
  return NextResponse.json(all);
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { date, bedtime, wakeTime, hours, quality, memo } = await req.json().catch(() => ({}));
  if (!date || hours == null) return NextResponse.json({ error: 'date, hours required' }, { status: 400 });
  const row = await prisma.sleep.upsert({
    where: { userId_date: { userId: user.id, date: String(date) } },
    create: {
      userId: user.id, date: String(date),
      bedtime: bedtime || null, wakeTime: wakeTime || null,
      hours: Number(hours), quality: quality != null ? Number(quality) : null,
      memo: memo || null
    },
    update: {
      bedtime: bedtime || null, wakeTime: wakeTime || null,
      hours: Number(hours), quality: quality != null ? Number(quality) : null,
      memo: memo || null
    }
  });
  return NextResponse.json(row);
}
