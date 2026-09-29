import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CalendarDays, Store, BarChart3, Settings, LogOut } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { signOutAction } from "./actions";

const NAV = [
  { href: "/dashboard", label: "投稿予定・承認", icon: CalendarDays },
  { href: "/dashboard/stores", label: "店舗", icon: Store },
  { href: "/dashboard/insights", label: "実績", icon: BarChart3 },
  { href: "/dashboard/settings", label: "設定", icon: Settings },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-56 bg-white border-b md:border-b-0 md:border-r flex md:flex-col">
        <div className="px-4 py-3 font-bold text-brand hidden md:block">接骨院 投稿管理</div>
        <nav className="flex md:flex-col flex-1 overflow-x-auto p-2 gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-700 hover:bg-brand-light hover:text-brand-dark whitespace-nowrap"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>
        <form action={signOutAction} className="p-2 md:border-t">
          <button className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 w-full">
            <LogOut size={16} />
            <span className="hidden md:inline">ログアウト</span>
          </button>
        </form>
      </aside>
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
