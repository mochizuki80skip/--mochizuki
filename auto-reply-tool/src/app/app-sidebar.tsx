"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarProps = {
  userEmail: string;
  trainerDisplayName: string | null;
};

export function AppSidebar({ userEmail, trainerDisplayName }: SidebarProps) {
  return (
    <aside className="bg-ink-900 text-white flex flex-col w-60 min-h-screen sticky top-0">
      <div className="px-4 py-5 flex items-center gap-2 border-b border-ink-800">
        <div className="w-9 h-9 rounded bg-brand-500 text-white font-bold flex items-center justify-center">
          O
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">ONE&apos;S BODY</div>
          <div className="text-[10px] text-gray-400">返信アシスタント</div>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-ink-800">
        <div className="bg-ink-800 rounded px-3 py-2 text-xs">
          <div className="text-[10px] text-brand-300 mb-0.5">
            {trainerDisplayName ? "トレーナー" : "スタッフ"}
          </div>
          <div className="truncate font-medium">
            {trainerDisplayName ?? userEmail}
          </div>
          {trainerDisplayName && (
            <div className="text-[10px] text-gray-500 truncate mt-0.5">
              {userEmail}
            </div>
          )}
        </div>
      </div>

      <nav className="px-3 py-4 space-y-6 flex-1 overflow-y-auto">
        <NavSection title="管理">
          <NavItem href="/" icon="🏠" label="ホーム" />
          <NavItem href="/customers" icon="👥" label="お客様一覧" />
        </NavSection>

        <NavSection title="設定">
          <NavItem href="/settings/profile" icon="🧑‍🏫" label="トレーナー設定" />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-ink-800 rounded transition"
            >
              <span>🚪</span>
              <span>ログアウト</span>
            </button>
          </form>
        </NavSection>
      </nav>

      <div className="px-4 py-3 text-[10px] text-gray-500 border-t border-ink-800">
        v0.4 · Week 3
      </div>
    </aside>
  );
}

function NavSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="px-3 mb-2 text-[10px] uppercase tracking-wider text-gray-500">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  const pathname = usePathname();
  const isHome = href === "/";
  const active = isHome ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 text-sm rounded transition ${
        active
          ? "bg-brand-500 text-white font-medium"
          : "text-gray-300 hover:bg-ink-800"
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
