import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ChannelsListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "super_admin") redirect("/dashboard");

  const channels = await prisma.lineChannel.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { friends: true, memberships: true } },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="text-lg font-bold text-line">
            ← LINE Platform
          </Link>
          <Link
            href="/dashboard/channels/new"
            className="bg-line text-white px-3 py-1.5 rounded text-sm flex items-center gap-1"
          >
            <Plus size={14} /> LINE アカウント追加
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">LINE アカウント管理</h1>

        <div className="bg-white border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">名前</th>
                <th className="px-4 py-2 font-medium">友だち数</th>
                <th className="px-4 py-2 font-medium">担当者数</th>
                <th className="px-4 py-2 font-medium">状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
                      style={{ background: c.color }}
                    />
                    {c.name}
                  </td>
                  <td className="px-4 py-2">{c._count.friends}</td>
                  <td className="px-4 py-2">{c._count.memberships}</td>
                  <td className="px-4 py-2">
                    {c.isActive ? (
                      <span className="text-line-dark">有効</span>
                    ) : (
                      <span className="text-gray-400">無効</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/dashboard/c/${c.id}/settings`}
                      className="text-line-dark hover:underline"
                    >
                      設定
                    </Link>
                  </td>
                </tr>
              ))}
              {channels.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    LINE アカウントがまだ登録されていません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
