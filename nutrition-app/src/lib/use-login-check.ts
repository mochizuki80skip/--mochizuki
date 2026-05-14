'use client';
import { useEffect, useState } from 'react';

/**
 * ログイン状態をクライアント側で判定するフック。
 * - null: チェック中（SSR / 初期マウント）
 * - true: ログイン済み（om_session Cookie あり）
 * - false: 未ログイン → LoginRequiredModal を出す対象
 */
export function useLoginCheck(): boolean | null {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const ok = document.cookie.split(';').some((c) => c.trim().startsWith('om_session='));
    setLoggedIn(ok);
  }, []);
  return loggedIn;
}
