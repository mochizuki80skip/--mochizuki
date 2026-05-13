'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ToastContextValue {
  toast: (msg: string) => void;
}
const ToastCtx = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string>('');
  const [show, setShow] = useState(false);

  const toast = useCallback((m: string) => {
    setMsg(m);
    setShow(true);
    setTimeout(() => setShow(false), 1800);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className={`toast ${show ? 'show' : ''}`} aria-live="polite">{msg}</div>
    </ToastCtx.Provider>
  );
}
