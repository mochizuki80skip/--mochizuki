import { redirect } from "next/navigation";
import { getCurrentUser, listAccessibleChannels } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Composer } from "./Composer";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const channels = await listAccessibleChannels(user.id, user.role);
  const ids = channels.map((c) => c.id);

  const [followerGroups, tagRows] = await Promise.all([
    prisma.friend.groupBy({
      by: ["lineChannelId"],
      where: { lineChannelId: { in: ids }, isFollowing: true },
      _count: { _all: true },
    }),
    prisma.tag.findMany({ where: { lineChannelId: { in: ids } }, select: { name: true, lineChannelId: true } }),
  ]);
  const followers = new Map(followerGroups.map((g) => [g.lineChannelId, g._count._all]));

  // タグは「名前」単位でまとめ、どのアカウントに存在するかを持たせる
  const byName = new Map<string, string[]>();
  for (const t of tagRows) byName.set(t.name, [...(byName.get(t.name) ?? []), t.lineChannelId]);
  const tags = [...byName.entries()]
    .map(([name, channelIds]) => ({ name, channelIds }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">一括配信を作成</h1>
      <Composer
        channels={channels.map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          followers: followers.get(c.id) ?? 0,
        }))}
        tags={tags}
      />
    </div>
  );
}
