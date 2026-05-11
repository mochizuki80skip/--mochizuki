import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  scheduled: "予約済",
  sending: "送信中",
  sent: "送信済",
  failed: "失敗",
};

export default async function BroadcastsPage() {
  const broadcasts = await prisma.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">一斉配信</h1>
        <Link href="/dashboard/broadcasts/new" className="bg-line text-white px-3 py-1.5 rounded text-sm">
          新規作成
        </Link>
      </div>
      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">タイトル</th>
              <th className="px-4 py-2 font-medium">状態</th>
              <th className="px-4 py-2 font-medium">予約 / 送信日時</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="px-4 py-2">{b.title}</td>
                <td className="px-4 py-2">{STATUS_LABEL[b.status] ?? b.status}</td>
                <td className="px-4 py-2 text-gray-500">
                  {b.sentAt
                    ? `送信: ${new Date(b.sentAt).toLocaleString("ja-JP")}`
                    : b.scheduledAt
                    ? `予約: ${new Date(b.scheduledAt).toLocaleString("ja-JP")}`
                    : "-"}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/dashboard/broadcasts/${b.id}`} className="text-line-dark hover:underline">
                    詳細
                  </Link>
                </td>
              </tr>
            ))}
            {broadcasts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-gray-500">
                  配信はまだありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
