import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { storeChannels } from "@/lib/posts";
import { fmtJst } from "@/lib/themes";
import type { Flag } from "@/lib/compliance";
import { BatchReview, type ReviewPost } from "./BatchReview";

export const dynamic = "force-dynamic";
// AI 作成を小分けに実行するため
export const maxDuration = 60;

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const batch = await prisma.postBatch.findUnique({
    where: { id },
    include: {
      posts: {
        include: { store: true, deliveries: true },
        orderBy: [{ store: { sortOrder: "asc" } }, { store: { name: "asc" } }],
      },
    },
  });
  if (!batch) notFound();

  const posts: ReviewPost[] = batch.posts.map((p) => ({
    id: p.id,
    storeName: p.store.name,
    storeArea: p.store.area,
    channels: storeChannels(p.store),
    gbpText: p.gbpText,
    igCaption: p.igCaption,
    imageUrl: p.imageUrl ?? "",
    status: p.status,
    flags: p.flags as Flag[],
    error: p.error,
    deliveries: p.deliveries.map((d) => ({ channel: d.channel, status: d.status, error: d.error })),
  }));

  return (
    <BatchReview
      batch={{ id: batch.id, when: fmtJst(batch.scheduledAt), theme: batch.theme, memo: batch.memo, imageUrl: batch.imageUrl }}
      posts={posts}
    />
  );
}
