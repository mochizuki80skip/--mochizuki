'use client';
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BottomNav, Sidebar, TopBar, NavUser, UserFeatures } from './Navigation';
import { ToastProvider } from '@/components/ui/Toast';
import { LoginRequiredModal } from '@/components/auth/LoginRequiredModal';
import { useLoginCheck } from '@/lib/use-login-check';

interface AppShellProps {
  children: ReactNode;
  user?: NavUser | null;
  features?: UserFeatures;
  isTrainer?: boolean;
  hideNav?: boolean;
  /** 認証不要のページ（welcome等）で true にすると LoginRequiredModal を抑制 */
  skipAuth?: boolean;
}

// 認証チェックを除外するパス
const PUBLIC_PATHS = ['/welcome', '/onboarding', '/trainer'];

const DEFAULT_FEATURES: UserFeatures = {
  featExercise: false,
  featSleep: false,
  featWater: false,
  featSteps: false
};

export function AppShell({ children, user, features, isTrainer, hideNav, skipAuth }: AppShellProps) {
  const f = features || DEFAULT_FEATURES;
  const pathname = usePathname();
  const loggedIn = useLoginCheck();
  // 認証ゲート: public パスでも skipAuth でもなく、明確に未ログインなら表示
  const isPublic = skipAuth || PUBLIC_PATHS.some((p) => pathname?.startsWith(p));
  const showLoginModal = !isPublic && loggedIn === false && !user;

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
      <LoginRequiredModal visible={showLoginModal} />
    </ToastProvider>
  );
}
