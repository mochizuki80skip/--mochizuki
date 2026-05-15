import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Users, Send, Workflow, Tag, LayoutDashboard, LogOut, Settings, ArrowLeft, ChevronDown, Calendar } from "lucide-react";
import { getCurrentUser, canAccessChannel, listAccessibleChannels } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { signOutAction } from "../../actions";
import { ChannelSwitcher } from "./ChannelSwitcher";

export default async function ChannelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ok = await canAccessChannel(user.id, user.role, channelId);
  if (!ok) redirect("/dashboard");

  const channel = await prisma.lineChannel.findUnique({ where: { id: channelId } });
  if (!channel) notFound();

  const reservationSettings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
    select: { isEnabled: true },
  });
  const reservationsEnabled = reservationSettings?.isEnabled ?? false;

  const accessibleChannels = await listAccessibleChannels(user.id, user.role);

  const base = `/dashboard/c/${channelId}`;
  const nav = [
    { href: base, label: "ダッシュボード", icon: LayoutDashboard, exact: true },
    { href: `${base}/friends`, label: "友だち", icon: Users },
    { href: `${base}/tags`, label: "タグ", icon: Tag },
    { href: `${base}/broadcasts`, label: "一斉配信", icon: Send },
    { href: `${base}/scenarios`, label: "ステップ配信", icon: Workflow },
    ...(reservationsEnabled
      ? [{ href: `${base}/reservations`, label: "予約管理", icon: Calendar }]
      : []),
    { href: `${base}/settings`, label: "設定", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-white border-r flex flex-col">
        <div className="px-4 py-3 border-b">
          <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ArrowLeft size={12} /> LINE 切替
          </Link>
          <ChannelSwitcher
            current={{ id: channel.id, name: channel.name, color: channel.color }}
            channels={accessibleChannels.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
          />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {nav.map((n) => {
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

        <div className="p-3 border-t space-y-2">
          {user.role === "super_admin" && (
            <Link
              href="/dashboard/channels"
              className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100"
            >
              <ChevronDown size={16} />
              全 LINE 管理
            </Link>
          )}
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 w-full"
            >
              <LogOut size={16} />
              ログアウト
            </button>
          </form>
          <div className="text-xs text-gray-400 px-3">
            {user.email}
            <br />
            {user.role === "super_admin" ? "管理者" : "オペレーター"}
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
