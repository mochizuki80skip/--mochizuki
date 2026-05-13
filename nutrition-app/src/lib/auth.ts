// 認証ユーティリティ — エンドユーザー & 管理者
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { verifyLineIdToken } from './line-auth';
import { randomBytes } from 'crypto';

const USER_COOKIE = 'om_user';
const TRAINER_COOKIE = 'om_trainer';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// ---- エンドユーザーセッション (LIFF idToken -> User row) ----

export async function exchangeIdTokenForUser(idToken: string) {
  const payload = await verifyLineIdToken(idToken);
  if (!payload?.sub) return null;

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

  return user;
}

export async function setUserCookie(userId: string) {
  const c = await cookies();
  c.set(USER_COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });
}

export async function getCurrentUser() {
  const c = await cookies();
  const id = c.get(USER_COOKIE)?.value;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id } });
}

export async function clearUserCookie() {
  const c = await cookies();
  c.delete(USER_COOKIE);
}

// ---- トレーナーセッション ----

const TRAINER_ALLOWLIST = (process.env.TRAINER_LINE_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const OWNER_LINE_USER_IDS = (process.env.OWNER_LINE_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

export function isTrainerAllowed(lineUserId: string) {
  if (TRAINER_ALLOWLIST.length === 0 && OWNER_LINE_USER_IDS.length === 0) return false;
  return TRAINER_ALLOWLIST.includes(lineUserId) || OWNER_LINE_USER_IDS.includes(lineUserId);
}

export function isOwner(lineUserId: string) {
  return OWNER_LINE_USER_IDS.includes(lineUserId);
}

export type TrainerAuthResult =
  | { ok: true; trainer: any; token: string }
  | { ok: false; reason: 'invalid_token' }
  | { ok: false; reason: 'not_allowed'; lineUserId: string; displayName?: string };

export async function exchangeIdTokenForTrainer(idToken: string): Promise<TrainerAuthResult> {
  const payload = await verifyLineIdToken(idToken);
  if (!payload?.sub) return { ok: false, reason: 'invalid_token' };

  // Bootstrap mode: env var が空 AND DB に Trainer がまだ1件もいない場合、最初の人を owner にする
  let role: 'owner' | 'trainer';
  if (TRAINER_ALLOWLIST.length === 0 && OWNER_LINE_USER_IDS.length === 0) {
    const trainerCount = await prisma.trainer.count();
    if (trainerCount === 0) {
      role = 'owner';
    } else {
      return { ok: false, reason: 'not_allowed', lineUserId: payload.sub, displayName: payload.name };
    }
  } else if (!isTrainerAllowed(payload.sub)) {
    return { ok: false, reason: 'not_allowed', lineUserId: payload.sub, displayName: payload.name };
  } else {
    role = isOwner(payload.sub) ? 'owner' : 'trainer';
  }

  const trainer = await prisma.trainer.upsert({
    where: { lineUserId: payload.sub },
    create: {
      lineUserId: payload.sub,
      displayName: payload.name || 'トレーナー',
      pictureUrl: payload.picture || null,
      role
    },
    update: {
      displayName: payload.name || undefined,
      pictureUrl: payload.picture || undefined,
      role,
      isActive: true
    }
  });

  // create session token
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + COOKIE_MAX_AGE * 1000);
  await prisma.trainerSession.create({ data: { trainerId: trainer.id, token, expiresAt } });

  return { ok: true, trainer, token };
}

export async function setTrainerCookie(token: string) {
  const c = await cookies();
  c.set(TRAINER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  });
}

export async function getCurrentTrainer() {
  const c = await cookies();
  const token = c.get(TRAINER_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.trainerSession.findUnique({
    where: { token }
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.trainerSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return prisma.trainer.findUnique({ where: { id: session.trainerId } });
}

export async function clearTrainerCookie() {
  const c = await cookies();
  const token = c.get(TRAINER_COOKIE)?.value;
  if (token) await prisma.trainerSession.delete({ where: { token } }).catch(() => {});
  c.delete(TRAINER_COOKIE);
}
