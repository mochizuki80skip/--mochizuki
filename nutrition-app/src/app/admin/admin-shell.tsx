'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Users, UserPlus, ListTodo, Ticket, ShieldCheck, LogOut } from 'lucide-react';
import { ReactNode } from 'react';
import Image from 'next/image';

interface AdminShellProps {
  trainer: { displayName: string; pictureUrl: string | null; role: string };
  children: ReactNode;
}

const NAV = [
  { href: '/admin', label: 'ダッシュボード', icon: LayoutDashboard, exact: true },
  { href: '/admin/members', label: '会員', icon: Users },
  { href: '/admin/users', label: '一般ユーザー', icon: UserPlus },
  { href: '/admin/leads', label: '見込み客', icon: ListTodo },
  { href: '/admin/codes', label: '招待コード', icon: Ticket },
  { href: '/admin/trainers', label: 'トレーナー', icon: ShieldCheck, ownerOnly: true }
];

export function AdminShell({ trainer, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isOwner = trainer.role === 'owner';

  const onLogout = async () => {
    if (!confirm('ログアウトしますか？')) return;
    await fetch('/api/admin/auth', { method: 'DELETE' });
    router.replace('/admin/login');
  };

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="min-h-screen bg-surface-alt flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-ink-line flex-col">
        <div className="p-5 border-b border-ink-line flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <path d="M14 4 L15.5 12.5 L24 14 L15.5 15.5 L14 24 L12.5 15.5 L4 14 L12.5 12.5 Z" fill="#FFF" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-sm">ONE'S MEAL</div>
            <div className="text-[10px] text-ink-mute">管理サイト</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.filter((n) => !n.ownerOnly || isOwner).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive(n.href, n.exact) ? 'bg-brand-50 text-brand-600' : 'text-ink-dim hover:bg-surface-alt'
              }`}
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-ink-line">
          <div className="flex items-center gap-3 mb-2 px-2">
            {trainer.pictureUrl ? (
              <Image src={trainer.pictureUrl} alt="" width={32} height={32} className="rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center font-bold text-brand-600">
                {trainer.displayName.slice(0, 1)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{trainer.displayName}</div>
              <div className="text-[10px] text-ink-mute uppercase tracking-wide">{trainer.role}</div>
            </div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-dim hover:bg-surface-alt rounded-lg">
            <LogOut className="w-4 h-4" /> ログアウト
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden bg-white border-b border-ink-line p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
                <path d="M14 4 L15.5 12.5 L24 14 L15.5 15.5 L14 24 L12.5 15.5 L4 14 L12.5 12.5 Z" fill="#FFF" />
              </svg>
            </div>
            <span className="font-bold text-sm">管理サイト</span>
          </div>
          <button onClick={onLogout} className="text-xs text-ink-dim">ログアウト</button>
        </header>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-ink-line grid grid-cols-5">
          {NAV.filter((n) => !n.ownerOnly || isOwner).slice(0, 5).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex flex-col items-center justify-center py-2 gap-1 text-[10px] font-medium ${
                isActive(n.href, n.exact) ? 'text-brand-600' : 'text-ink-mute'
              }`}
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
