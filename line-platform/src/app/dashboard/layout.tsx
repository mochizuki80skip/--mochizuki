import Link from "next/link";
import { Users, Send, Workflow, Tag, LayoutDashboard, LogOut } from "lucide-react";
import { signOutAction } from "./actions";

const NAV = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard },
  { href: "/dashboard/friends", label: "友だち", icon: Users },
  { href: "/dashboard/tags", label: "タグ", icon: Tag },
  { href: "/dashboard/broadcasts", label: "一斉配信", icon: Send },
  { href: "/dashboard/scenarios", label: "ステップ配信", icon: Workflow },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-white border-r flex flex-col">
        <div className="px-5 py-4 border-b">
          <div className="text-lg font-bold text-line">LINE Platform</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-700 hover:bg-line-light hover:text-line-dark"
              >
                <Icon size={16} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <form action={signOutAction} className="p-3 border-t">
          <button
            type="submit"
            className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 w-full"
          >
            <LogOut size={16} />
            ログアウト
          </button>
        </form>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
