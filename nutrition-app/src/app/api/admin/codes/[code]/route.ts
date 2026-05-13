import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTrainer } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const trainer = await getCurrentTrainer();
  if (!trainer) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { code } = await params;
  const existing = await prisma.memberCode.findUnique({ where: { code } });
  if (!existing) return NextResponse.json({ ok: true });
  if (existing.used) return NextResponse.json({ error: 'already used' }, { status: 400 });
  await prisma.memberCode.delete({ where: { code } });
  return NextResponse.json({ ok: true });
}
