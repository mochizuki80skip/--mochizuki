'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Utensils, BarChart3, User2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  onFabClick?: () => void;
}

export function BottomNav({ onFabClick }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const is = (p: string) => pathname === p || pathname.startsWith(p + '/');

  const handleFab = () => {
    if (onFabClick) onFabClick();
    else router.push('/log');
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-ink-line" style={{ paddingBottom: 'var(--safe-bottom)' }}>
        <div className="mx-auto max-w-screen grid grid-cols-5 relative">
          <NavItem href="/" icon={<Home className="w-5 h-5" />} label="ホーム" active={is('/') && pathname === '/'} />
          <NavItem href="/weight" icon={<BarChart3 className="w-5 h-5" />} label="体組成" active={is('/weight')} />
          <div /> {/* spacer for FAB */}
          <NavItem href="/log" icon={<Utensils className="w-5 h-5" />} label="食事" active={is('/log')} />
          <NavItem href="/settings" icon={<User2 className="w-5 h-5" />} label="設定" active={is('/settings')} />
        </div>
      </nav>
      <button
        onClick={handleFab}
        className="fixed left-1/2 -translate-x-1/2 z-40 w-14 h-14 rounded-full bg-brand-500 shadow-fab flex items-center justify-center active:scale-95 transition"
        style={{ bottom: 'calc(20px + var(--safe-bottom))' }}
        aria-label="食事を追加"
      >
        <FabIcon />
      </button>
    </>
  );
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex flex-col items-center justify-center py-2 gap-1 text-[10px] font-medium transition',
        active ? 'text-brand-600' : 'text-ink-mute'
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

function FabIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <path d="M14 4 L15.5 12.5 L24 14 L15.5 15.5 L14 24 L12.5 15.5 L4 14 L12.5 12.5 Z" fill="#FFF" />
    </svg>
  );
}
