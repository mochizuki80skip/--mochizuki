import { prisma } from "@/lib/prisma";
import { BroadcastForm } from "../BroadcastForm";

export const dynamic = "force-dynamic";

export default async function NewBroadcast({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const tags = await prisma.tag.findMany({
    where: { lineChannelId: channelId },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">一斉配信 / 新規作成</h1>
      <BroadcastForm
        channelId={channelId}
        tags={tags.map((t) => ({ id: t.id, name: t.name, color: t.color }))}
      />
    </div>
  );
}
