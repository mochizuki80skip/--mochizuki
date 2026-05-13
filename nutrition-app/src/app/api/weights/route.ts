import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const weights = await prisma.weight.findMany({
    where: { userId: user.id },
    orderBy: { date: 'asc' }
  });
  return NextResponse.json(weights);
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { date, weight, bodyFat } = await req.json();
  if (!date || !weight) return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  const row = await prisma.weight.upsert({
    where: { userId_date: { userId: user.id, date: String(date) } },
    create: { userId: user.id, date: String(date), weight: Number(weight), bodyFat: bodyFat != null ? Number(bodyFat) : null },
    update: { weight: Number(weight), bodyFat: bodyFat != null ? Number(bodyFat) : null }
  });
  // Sync latest weight to user profile if today
  const today = new Date().toISOString().slice(0, 10);
  if (date === today) {
    await prisma.user.update({ where: { id: user.id }, data: { weightKg: Number(weight) } });
  }
  return NextResponse.json(row);
}
