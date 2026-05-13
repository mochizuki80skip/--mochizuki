import { NextRequest, NextResponse } from 'next/server';
import { getCurrentTrainer } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const trainer = await getCurrentTrainer();
  if (!trainer) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { code, note } = await req.json().catch(() => ({}));
  if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });
  const normalized = String(code).trim().toUpperCase();
  try {
    const created = await prisma.memberCode.create({
      data: { code: normalized, note: note ? String(note).slice(0, 200) : null, createdBy: trainer.id }
    });
    return NextResponse.json(created);
  } catch {
    return NextResponse.json({ error: 'duplicate' }, { status: 409 });
  }
}
