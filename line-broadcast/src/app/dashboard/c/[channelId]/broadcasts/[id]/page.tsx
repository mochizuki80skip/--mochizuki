import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ExecuteButton } from "./ExecuteButton";

export const dynamic = "force-dynamic";

export default async function BroadcastDetail({
  params,
}: {
  params: Promise<{ channelId: string; id: string }>;
}) {
  const { channelId, id } = await params;
  const b = await prisma.broadcast.findFirst({
    where: { id, lineChannelId: channelId },
    include: { tags: { include: { tag: true } } },
  });
  if (!b) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{b.title}</h1>
      <div className="bg-white border rounded p-5 space-y-2 text-sm">
        <div>
          <span className="text-gray-500">状態：</span>
          {b.status}
        </div>
        <div>
          <span className="text-gray-500">対象：</span>
          {b.targetAllFollowers && b.tags.length === 0
            ? "全員"
            : b.tags.map((t) => t.tag.name).join(", ")}
        </div>
        <div>
          <span className="text-gray-500">予約：</span>
          {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString("ja-JP") : "-"}
        </div>
        <div>
          <span className="text-gray-500">送信：</span>
          {b.sentAt ? new Date(b.sentAt).toLocaleString("ja-JP") : "-"}
        </div>
        {b.errorMessage && <div className="text-red-600">エラー: {b.errorMessage}</div>}
        <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
{JSON.stringify(b.messages, null, 2)}
        </pre>
      </div>

      {(b.status === "draft" || b.status === "scheduled") && (
        <ExecuteButton channelId={channelId} id={b.id} />
      )}
    </div>
  );
}
