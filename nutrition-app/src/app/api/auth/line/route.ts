import { NextRequest, NextResponse } from 'next/server';
import { setUserCookie, clearUserCookie } from '@/lib/auth';
import { verifyLineIdTokenDetailed } from '@/lib/line-auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { idToken } = await req.json().catch(() => ({}));
  if (!idToken || typeof idToken !== 'string') {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }

  const result = await verifyLineIdTokenDetailed(idToken);
  if (!result.ok) {
    return NextResponse.json({
      error: result.reason === 'no_channel_id'
        ? 'サーバー設定不備：LINE_LOGIN_CHANNEL_ID 未設定'
        : 'LINEのIDトークン検証に失敗',
      detail: result.detail,
      reason: result.reason,
      status: result.status
    }, { status: 401 });
  }

  const payload = result.payload;
  const user = await prisma.user.upsert({
    where: { lineUserId: payload.sub },
    create: {
      lineUserId: payload.sub,
      displayName: payload.name || 'ゲスト',
      pictureUrl: payload.picture || null,
      email: payload.email || null
    },
    update: {
      displayName: payload.name || undefined,
      pictureUrl: payload.picture || undefined,
      email: payload.email || undefined,
      lastSeenAt: new Date()
    }
  });

  await setUserCookie(user.id);
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      displayName: user.displayName,
      pictureUrl: user.pictureUrl,
      isMember: user.isMember
    }
  });
}

export async function DELETE() {
  await clearUserCookie();
  return NextResponse.json({ ok: true });
}
