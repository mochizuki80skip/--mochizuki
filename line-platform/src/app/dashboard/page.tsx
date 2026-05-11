import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [followers, totalFriends, tags, scheduledBroadcasts, runningScenarios, recentInbound] =
    await Promise.all([
      prisma.friend.count({ where: { isFollowing: true } }),
      prisma.friend.count(),
      prisma.tag.count(),
      prisma.broadcast.count({ where: { status: "scheduled" } }),
      prisma.scenarioRun.count({ where: { status: "running" } }),
      prisma.inboundMessage.findMany({
        take: 10,
        orderBy: { receivedAt: "desc" },
        include: { friend: true },
      }),
    ]);

  const stats = [
    { label: "現在の友だち（ブロック除く）", value: followers },
    { label: "累計友だち数", value: totalFriends },
    { label: "タグ数", value: tags },
    { label: "予約配信", value: scheduledBroadcasts },
    { label: "稼働中シナリオ", value: runningScenarios },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">ダッシュボード</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border rounded p-4">
            <div className="text-xs text-gray-500">{s.label}</div>
            <div className="text-2xl font-bold mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border rounded">
        <div className="px-4 py-3 border-b font-medium">最近の受信メッセージ</div>
        <ul className="divide-y">
          {recentInbound.length === 0 && (
            <li className="px-4 py-6 text-sm text-gray-500">まだ受信メッセージはありません。</li>
          )}
          {recentInbound.map((m) => (
            <li key={m.id} className="px-4 py-3 text-sm flex justify-between gap-2">
              <div>
                <span className="font-medium">{m.friend.displayName ?? m.friend.lineUserId}</span>
                <span className="text-gray-500 ml-2">[{m.type}]</span>
                <div className="text-gray-700 truncate max-w-xl">{m.text ?? "(non-text)"}</div>
              </div>
              <div className="text-xs text-gray-400 shrink-0">
                {new Date(m.receivedAt).toLocaleString("ja-JP")}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
