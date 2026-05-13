import { NextRequest, NextResponse } from 'next/server';
import { exchangeIdTokenForTrainer, setTrainerCookie, clearTrainerCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { idToken } = await req.json().catch(() => ({}));
  if (!idToken) return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  const result = await exchangeIdTokenForTrainer(idToken);
  if (!result.ok) {
    if (result.reason === 'not_allowed') {
      return NextResponse.json({
        error: '許可リストに含まれていません',
        lineUserId: result.lineUserId,
        displayName: result.displayName,
        hint: 'このLINE userIdをVercelの OWNER_LINE_USER_IDS または TRAINER_LINE_USER_IDS に追加してください'
      }, { status: 403 });
    }
    return NextResponse.json({ error: 'IDトークンが無効です' }, { status: 401 });
  }
  await setTrainerCookie(result.token);
  return NextResponse.json({ ok: true, trainer: { id: result.trainer.id, displayName: result.trainer.displayName, role: result.trainer.role } });
}

export async function DELETE() {
  await clearTrainerCookie();
  return NextResponse.json({ ok: true });
}
