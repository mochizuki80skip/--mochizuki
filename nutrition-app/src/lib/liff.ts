// LIFF クライアントヘルパー — クライアント側で動的ロード
'use client';

import type { Liff } from '@line/liff';

let liffInstance: Liff | null = null;
let initPromise: Promise<Liff | null> | null = null;

export async function getLiff(liffId?: string): Promise<Liff | null> {
  if (liffInstance) return liffInstance;
  if (initPromise) return initPromise;

  const id = liffId || process.env.NEXT_PUBLIC_LIFF_ID;
  if (!id) return null;

  initPromise = (async () => {
    try {
      const mod = await import('@line/liff');
      const liff = mod.default;
      await liff.init({ liffId: id });
      liffInstance = liff;
      return liff;
    } catch (e) {
      console.error('LIFF init failed:', e);
      return null;
    }
  })();

  return initPromise;
}

export async function liffLogin() {
  const liff = await getLiff();
  if (!liff) return false;
  if (!liff.isLoggedIn()) {
    // 明示的に /welcome に戻すように指定（ルートにリダイレクトされて
    // サーバー側 redirect で OAuth params が失われるのを防ぐ）
    const redirectUri = typeof window !== 'undefined'
      ? `${window.location.origin}/welcome`
      : undefined;
    liff.login(redirectUri ? { redirectUri } : undefined);
    return false;
  }
  return true;
}

export async function liffProfile() {
  const liff = await getLiff();
  if (!liff || !liff.isLoggedIn()) return null;
  try {
    return await liff.getProfile();
  } catch {
    return null;
  }
}

export async function liffIdToken() {
  const liff = await getLiff();
  if (!liff || !liff.isLoggedIn()) return null;
  return liff.getIDToken();
}

export async function liffLogout() {
  const liff = await getLiff();
  if (!liff) return;
  liff.logout();
}

export async function isInLineClient() {
  const liff = await getLiff();
  return liff ? liff.isInClient() : false;
}
