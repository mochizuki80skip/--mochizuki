import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, MessageCircle } from "lucide-react";
import { signOutAction } from "./actions";
import { getCurrentUser, listAccessibleChannels } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const channels = await listAccessibleChannels(user.id, user.role);

  // 1 つだけならそのチャネルに直行
  if (channels.length === 1 && user.role !== "super_admin") {
    redirect(`/dashboard/c/${channels[0].id}`);
  }

  // 各チャネルの簡易統計を取得
  const stats = await Promise.all(
    channels.map(async (c) => ({
      channel: c,
      followers: await prisma.friend.count({
        where: { lineChannelId: c.id, isFollowing: true },
      }),
    })),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-line">LINE Platform</div>
            <div className="text-xs text-gray-500">{user.email}（{user.role === "super_admin" ? "管理者" : "オペレーター"}）</div>
          </div>
          <div className="flex items-center gap-3">
            {user.role === "super_admin" && (
              <Link
                href="/dashboard/channels"
                className="text-sm text-gray-700 hover:text-line-dark"
              >
                LINE 管理
              </Link>
            )}
            <form action={signOutAction}>
              <button type="submit" className="text-sm text-gray-600 hover:text-gray-900">
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">LINE アカウント一覧</h1>
          {user.role === "super_admin" && (
            <Link
              href="/dashboard/channels/new"
              className="bg-line text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"
            >
              <Plus size={14} /> LINE アカウント追加
            </Link>
          )}
        </div>

        {channels.length === 0 && (
          <div className="bg-white border rounded p-8 text-center text-gray-500">
            <MessageCircle size={48} className="mx-auto mb-3 text-gray-300" />
            {user.role === "super_admin" ? (
              <>
                LINE アカウントがまだ登録されていません。
                <div className="mt-3">
                  <Link
                    href="/dashboard/channels/new"
                    className="text-line-dark hover:underline"
                  >
                    最初の LINE アカウントを追加する →
                  </Link>
                </div>
              </>
            ) : (
              <>アクセス可能な LINE アカウントがありません。管理者にお問い合わせください。</>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map(({ channel, followers }) => (
            <Link
              key={channel.id}
              href={`/dashboard/c/${channel.id}`}
              className="bg-white border rounded p-5 hover:shadow-md transition block"
              style={{ borderTopColor: channel.color, borderTopWidth: 3 }}
            >
              <div className="font-medium text-lg">{channel.name}</div>
              {channel.description && (
                <div className="text-sm text-gray-500 mt-1">{channel.description}</div>
              )}
              <div className="mt-4 text-sm text-gray-700">
                友だち：<span className="font-bold text-line-dark">{followers}</span> 人
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
