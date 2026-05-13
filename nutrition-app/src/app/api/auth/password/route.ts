// パスワード変更（本人）
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/email-auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!newPassword) return NextResponse.json({ error: '新しいパスワードを入力してください' }, { status: 400 });
  if (!validatePassword(newPassword)) {
    return NextResponse.json({ error: 'パスワードは8文字以上にしてください' }, { status: 400 });
  }
  // 既にパスワード設定済みの場合は現在のパスワードを確認
  if (user.passwordHash) {
    if (!currentPassword) {
      return NextResponse.json({ error: '現在のパスワードを入力してください' }, { status: 400 });
    }
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) return NextResponse.json({ error: '現在のパスワードが違います' }, { status: 401 });
  }
  const hash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
  return NextResponse.json({ ok: true });
}
