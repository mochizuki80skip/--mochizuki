'use client';
import { ReactNode, useEffect, useState } from 'react';
import { BottomNav } from './BottomNav';
import { ToastProvider } from '@/components/ui/Toast';
import Image from 'next/image';

interface AppShellProps {
  children: ReactNode;
  user?: { displayName: string; pictureUrl: string | null; isMember: boolean } | null;
  hideTabBar?: boolean;
}

export function AppShell({ children, user, hideTabBar }: AppShellProps) {
  return (
    <ToastProvider>
      <div className="min-h-screen pb-24" style={{ paddingTop: 'var(--safe-top)' }}>
        <header className="sticky top-0 z-20 bg-white/85 backdrop-blur border-b border-ink-line">
          <div className="container-app py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrandMark />
              <span className="font-bold text-base tracking-wide">ONE'S MEAL</span>
            </div>
            {user && (
              <div className="flex items-center gap-2">
                {user.isMember && (
                  <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold">会員</span>
                )}
                {user.pictureUrl ? (
                  <Image src={user.pictureUrl} alt="" width={28} height={28} className="rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-ink-line flex items-center justify-center text-xs">
                    {user.displayName.slice(0, 1)}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <main className="container-app py-4">{children}</main>
        {!hideTabBar && <BottomNav />}
      </div>
    </ToastProvider>
  );
}

function BrandMark() {
  return (
    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
      <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
        <path d="M14 4 L15.5 12.5 L24 14 L15.5 15.5 L14 24 L12.5 15.5 L4 14 L12.5 12.5 Z" fill="#FFF" />
      </svg>
    </div>
  );
}
