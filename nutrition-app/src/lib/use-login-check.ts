'use client';
import { useState, useEffect } from 'react';

function readCookieSync(): boolean | null {
  if (typeof document === 'undefined') return null;
  return document.cookie.split(';').some((c) => c.trim().startsWith('om_session='));
}

/**
 * ログイン状態をクライアント側で判定するフック。
 * - null: SSR / 初回 hydration 前
 * - true: ログイン済み（om_session Cookie あり）
 * - false: 未ログイン → LoginRequiredModal を出す対象
 *
 * useState の initializer で同期的に Cookie を読むことで、
 * useEffect 待ちのフラッシュを防止する。
 */
export function useLoginCheck(): boolean | null {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(() => readCookieSync());
  useEffect(() => {
    // ハイドレーション後の再評価（SSR時に null だったケース）
    if (loggedIn === null) setLoggedIn(readCookieSync());
  }, [loggedIn]);
  return loggedIn;
}
