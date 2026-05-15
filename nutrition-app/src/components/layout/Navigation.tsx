'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Utensils, Dumbbell, LineChart, Settings, Sparkles, Moon, Droplets, Footprints, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { ReactNode } from 'react';

export interface UserFeatures {
  featExercise: boolean;
  featSleep: boolean;
  featWater: boolean;
  featSteps: boolean;
}

export interface NavUser {
  displayName: string;
  pictureUrl: string | null;
  isMember: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: any;
  visible: (f: UserFeatures) => boolean;
}

// すべてのナビ項目（visible で表示制御）
// 「アドバイス」はタブから外し、各画面に統合する方針
const ALL_NAV: NavItem[] = [
  { href: '/',          label: 'ホーム',       icon: Home,      visible: () => true },
  { href: '/log',       label: '食事',         icon: Utensils,  visible: () => true },
  { href: '/training',  label: 'トレーニング', icon: Dumbbell,  visible: (f) => f.featExercise },
  { href: '/weight',    label: '体組成',       icon: LineChart, visible: () => true },
  { href: '/settings',  label: '設定',         icon: Settings,  visible: () => true }
];

function visibleNav(features: UserFeatures, max: number = 5): NavItem[] {
  return ALL_NAV.filter((n) => n.visible(features)).slice(0, max);
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

/* ---------- Mobile Bottom Tab Bar（FABなし・可変タブ） ---------- */

export function BottomNav({ features }: { features: UserFeatures }) {
  const pathname = usePathname();
  const items = visibleNav(features, 5); // モバイルは最大5タブ
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-ink-line" style={{ paddingBottom: 'var(--safe-bottom)' }}>
      <div className={cn('grid', `grid-cols-${items.length}`)} style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'flex flex-col items-center justify-center py-2.5 gap-1 text-[10px] font-medium transition',
                active ? 'text-brand-600' : 'text-ink-mute'
              )}
            >
              <n.icon className={cn('w-5 h-5', active && 'stroke-[2.2]')} />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------- Desktop Sidebar ---------- */

export function Sidebar({ features, user, isTrainer }: { features: UserFeatures; user: NavUser | null; isTrainer?: boolean }) {
  const pathname = usePathname();
  const items = ALL_NAV.filter((n) => n.visible(features));
  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 bg-white border-r border-ink-line flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-ink-line">
        <BrandHeader />
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
                active ? 'bg-brand-50 text-brand-600' : 'text-ink-dim hover:bg-surface-alt'
              )}
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </Link>
          );
        })}

        {isTrainer && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2.5 mt-4 rounded-lg text-sm font-medium text-ink-dim hover:bg-surface-alt border-t border-ink-line pt-4"
          >
            <Settings className="w-4 h-4" />
            管理サイトへ
          </Link>
        )}
      </nav>

      <div className="p-3 border-t border-ink-line">
        {user ? (
          <div className="flex items-center gap-2 px-2 py-2">
            {user.pictureUrl ? (
              <Image src={user.pictureUrl} alt="" width={32} height={32} className="rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600">
                {user.displayName.slice(0, 1)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{user.displayName}</div>
              <div className="text-[10px] text-ink-mute">{user.isMember ? 'ONE\'S BODY 会員' : 'ゲスト'}</div>
            </div>
          </div>
        ) : (
          <Link
            href="/settings"
            className="block w-full text-center bg-brand-500 text-white text-sm font-bold py-2 rounded-lg hover:bg-brand-600 transition"
          >LINEログイン</Link>
        )}
      </div>
    </aside>
  );
}

/* ---------- 上部ヘッダー（モバイルのみ表示） ---------- */

export function TopBar({ user }: { user: NavUser | null }) {
  return (
    <header
      className="md:hidden sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-line"
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <BrandHeader />
        {user && (
          <div className="flex items-center gap-2">
            {user.isMember && (
              <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 text-[10px] font-bold">会員</span>
            )}
            {user.pictureUrl ? (
              <Image src={user.pictureUrl} alt="" width={28} height={28} className="rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-ink-line flex items-center justify-center text-xs font-bold">
                {user.displayName.slice(0, 1)}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

function BrandHeader() {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/app-icon.jpg"
        alt="ONE'S BODY"
        width={32}
        height={32}
        className="w-8 h-8 rounded-lg shrink-0 object-cover"
        priority
      />
      <div className="min-w-0">
        <div className="font-bold text-sm leading-tight truncate">ONE'S BODY</div>
        <div className="text-[10px] text-ink-mute leading-tight">食事管理サポート</div>
      </div>
    </div>
  );
}
