'use client';
import { useState, useEffect } from 'react';

function readCookieSync(): boolean | null {
  if (typeof document === 'undefined') return null;
  return document.cookie.split(';').some((c) => c.trim().startsWith('om_session='));
}

export function useLoginCheck(): boolean | null {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(() => readCookieSync());
  useEffect(() => {
    if (loggedIn === null) setLoggedIn(readCookieSync());
  }, [loggedIn]);
  return loggedIn;
}

/**
 * 未ログイン時に /welcome に強制リダイレクトするフック。
 * 各ページの一番上で呼ぶことで、ログイン必須を実現。
 */
export function useRequireLogin() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isLoggedIn = document.cookie.split(';').some((c) => c.trim().startsWith('om_session='));
    if (!isLoggedIn) {
      window.location.replace('/welcome');
    }
  }, []);
}
