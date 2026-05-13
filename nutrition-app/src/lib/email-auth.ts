// メアド + パスワード認証ヘルパー
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface EmailRegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export type EmailAuthResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid_email' | 'weak_password' | 'duplicate' | 'not_found' | 'wrong_password' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

export function validatePassword(p: string): boolean {
  return typeof p === 'string' && p.length >= 8;
}

export async function registerWithEmail(input: EmailRegisterInput): Promise<EmailAuthResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.displayName.trim();
  if (!validateEmail(email)) return { ok: false, reason: 'invalid_email' };
  if (!validatePassword(input.password)) return { ok: false, reason: 'weak_password' };

  // 既存チェック
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, reason: 'duplicate' };

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName: name || email.split('@')[0]
    }
  });
  return { ok: true, userId: user.id };
}

export async function loginWithEmail(email: string, password: string): Promise<EmailAuthResult> {
  const e = email.trim().toLowerCase();
  if (!validateEmail(e)) return { ok: false, reason: 'invalid_email' };
  const user = await prisma.user.findUnique({ where: { email: e } });
  if (!user || !user.passwordHash) return { ok: false, reason: 'not_found' };
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return { ok: false, reason: 'wrong_password' };
  // 最終アクセス更新
  await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  return { ok: true, userId: user.id };
}

/** 管理者によるパスワードリセット */
export async function adminResetPassword(userId: string, newPassword: string): Promise<EmailAuthResult> {
  if (!validatePassword(newPassword)) return { ok: false, reason: 'weak_password' };
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { ok: true, userId };
}
