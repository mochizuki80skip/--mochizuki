'use client';
import { ReactNode } from 'react';
import { BottomNav, Sidebar, TopBar, NavUser, UserFeatures } from './Navigation';
import { ToastProvider } from '@/components/ui/Toast';

interface AppShellProps {
  children: ReactNode;
  user?: NavUser | null;
  features?: UserFeatures;
  isTrainer?: boolean;
  hideNav?: boolean;
  /** 旧API互換用、現在は未使用 */
  skipAuth?: boolean;
}

const DEFAULT_FEATURES: UserFeatures = {
  featExercise: true,
  featSleep: true,
  featWater: true,
  featSteps: true
};

export function AppShell({ children, user, features, isTrainer, hideNav }: AppShellProps) {
  const f = features || DEFAULT_FEATURES;
  return (
    <ToastProvider>
      <div className="min-h-screen md:flex">
        {!hideNav && <Sidebar features={f} user={user || null} isTrainer={isTrainer} />}
        <div className="flex-1 min-w-0 flex flex-col">
          {!hideNav && <TopBar user={user || null} />}
          <main
            className="flex-1 mx-auto w-full max-w-3xl px-4 py-4 md:py-8 md:px-8"
            style={{ paddingBottom: 'calc(80px + var(--safe-bottom))' }}
          >
            {children}
          </main>
        </div>
        {!hideNav && <BottomNav features={f} />}
      </div>
    </ToastProvider>
  );
}
