import { NextRequest, NextResponse } from 'next/server';
import { exchangeIdTokenForUser, setUserCookie, clearUserCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { idToken } = await req.json().catch(() => ({}));
  if (!idToken || typeof idToken !== 'string') {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }
  const user = await exchangeIdTokenForUser(idToken);
  if (!user) return NextResponse.json({ error: 'invalid token' }, { status: 401 });
  await setUserCookie(user.id);
  return NextResponse.json({ ok: true, user: {
    id: user.id,
    displayName: user.displayName,
    pictureUrl: user.pictureUrl,
    isMember: user.isMember
  }});
}

export async function DELETE() {
  await clearUserCookie();
  return NextResponse.json({ ok: true });
}
