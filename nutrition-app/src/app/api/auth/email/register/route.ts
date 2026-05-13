import { NextRequest, NextResponse } from 'next/server';
import { registerWithEmail } from '@/lib/email-auth';
import { setUserCookie } from '@/lib/auth';

const ERR_MSG: Record<string, string> = {
  invalid_email: 'メールアドレスの形式が正しくありません',
  weak_password: 'パスワードは8文字以上にしてください',
  duplicate: 'このメールアドレスは既に登録済みです',
  not_found: 'ユーザーが見つかりません',
  wrong_password: 'パスワードが違います'
};

export async function POST(req: NextRequest) {
  const { email, password, displayName } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: 'email, password required' }, { status: 400 });
  }
  const result = await registerWithEmail({
    email: String(email),
    password: String(password),
    displayName: String(displayName || '').trim()
  });
  if (!result.ok) {
    return NextResponse.json({ error: ERR_MSG[result.reason] || '登録に失敗しました' }, { status: 400 });
  }
  await setUserCookie(result.userId);
  return NextResponse.json({ ok: true, userId: result.userId });
}
