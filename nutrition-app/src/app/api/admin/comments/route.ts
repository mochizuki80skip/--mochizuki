import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTrainer } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const trainer = await getCurrentTrainer();
  if (!trainer) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { userId, content, date } = await req.json().catch(() => ({}));
  if (!userId || !content) return NextResponse.json({ error: 'missing fields' }, { status: 400 });
  const comment = await prisma.trainerComment.create({
    data: {
      userId: String(userId),
      trainerId: trainer.id,
      content: String(content).slice(0, 2000),
      date: date ? String(date) : null
    },
    include: { trainer: { select: { displayName: true, pictureUrl: true } } }
  });
  return NextResponse.json({
    id: comment.id,
    content: comment.content,
    date: comment.date,
    createdAt: comment.createdAt.toISOString(),
    trainer: comment.trainer
  });
}
