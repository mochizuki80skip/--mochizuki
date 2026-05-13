import { NextRequest, NextResponse } from 'next/server';
import { loginWithEmail } from '@/lib/email-auth';
import { setUserCookie } from '@/lib/auth';

const ERR_MSG: Record<string, string> = {
  invalid_email: 'メールアドレスの形式が正しくありません',
  weak_password: 'パスワードは8文字以上にしてください',
  duplicate: 'このメールアドレスは既に登録済みです',
  not_found: 'ユーザーが見つかりません',
  wrong_password: 'パスワードが違います'
};

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: 'email, password required' }, { status: 400 });
  }
  const result = await loginWithEmail(String(email), String(password));
  if (!result.ok) {
    // セキュリティ的に「メアドかパスワードが間違っています」で統一
    if (result.reason === 'not_found' || result.reason === 'wrong_password') {
      return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います' }, { status: 401 });
    }
    return NextResponse.json({ error: ERR_MSG[result.reason] || 'ログインに失敗しました' }, { status: 400 });
  }
  await setUserCookie(result.userId);
  return NextResponse.json({ ok: true, userId: result.userId });
}
