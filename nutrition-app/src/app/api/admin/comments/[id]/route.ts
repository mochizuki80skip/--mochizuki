import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTrainer } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const trainer = await getCurrentTrainer();
  if (!trainer) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const comment = await prisma.trainerComment.findUnique({ where: { id } });
  if (!comment) return NextResponse.json({ ok: true });
  // Trainer can only delete own comments unless owner
  if (comment.trainerId !== trainer.id && trainer.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  await prisma.trainerComment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
