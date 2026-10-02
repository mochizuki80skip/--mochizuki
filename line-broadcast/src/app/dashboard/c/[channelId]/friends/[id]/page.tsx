import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TagPicker } from "./TagPicker";
import { NotesEditor } from "./NotesEditor";

export const dynamic = "force-dynamic";

export default async function FriendDetail({
  params,
}: {
  params: Promise<{ channelId: string; id: string }>;
}) {
  const { channelId, id } = await params;
  const friend = await prisma.friend.findFirst({
    where: { id, lineChannelId: channelId },
    include: {
      tags: { include: { tag: true } },
      inboundMessages: { orderBy: { receivedAt: "desc" }, take: 50 },
    },
  });
  if (!friend) notFound();

  const allTags = await prisma.tag.findMany({
    where: { lineChannelId: channelId },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded p-5">
        <div className="flex items-center gap-4">
          {friend.pictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={friend.pictureUrl} alt="" className="w-16 h-16 rounded-full" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200" />
          )}
          <div>
            <div className="text-lg font-semibold">{friend.displayName ?? "(no name)"}</div>
            <div className="text-xs text-gray-500">{friend.lineUserId}</div>
            <div className="text-xs mt-1">
              {friend.isFollowing ? (
                <span className="text-line-dark">フォロー中</span>
              ) : (
                <span className="text-gray-400">ブロック中</span>
              )}
              <span className="ml-3 text-gray-500">
                追加: {new Date(friend.followedAt).toLocaleString("ja-JP")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded p-5">
        <h2 className="font-medium mb-3">タグ</h2>
        <TagPicker
          channelId={channelId}
          friendId={friend.id}
          attachedTagIds={friend.tags.map((t) => t.tagId)}
          allTags={allTags}
        />
      </div>

      <div className="bg-white border rounded p-5">
        <h2 className="font-medium mb-3">メモ</h2>
        <NotesEditor channelId={channelId} friendId={friend.id} initial={friend.notes ?? ""} />
      </div>

      <div className="bg-white border rounded">
        <div className="px-4 py-3 border-b font-medium">メッセージ履歴</div>
        <ul className="divide-y">
          {friend.inboundMessages.length === 0 && (
            <li className="px-4 py-6 text-sm text-gray-500">受信メッセージはありません。</li>
          )}
          {friend.inboundMessages.map((m) => (
            <li key={m.id} className="px-4 py-3 text-sm">
              <div className="text-xs text-gray-400">
                [{m.type}] {new Date(m.receivedAt).toLocaleString("ja-JP")}
              </div>
              <div className="mt-1">{m.text ?? "(non-text)"}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
