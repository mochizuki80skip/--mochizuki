import { NextRequest, NextResponse } from 'next/server';
import { exchangeIdTokenForTrainer, setTrainerCookie, clearTrainerCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { idToken } = await req.json().catch(() => ({}));
  if (!idToken) return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  const result = await exchangeIdTokenForTrainer(idToken);
  if (!result) return NextResponse.json({ error: '許可リストに含まれていません' }, { status: 403 });
  await setTrainerCookie(result.token);
  return NextResponse.json({ ok: true, trainer: { id: result.trainer.id, displayName: result.trainer.displayName, role: result.trainer.role } });
}

export async function DELETE() {
  await clearTrainerCookie();
  return NextResponse.json({ ok: true });
}
