import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { storeChannels } from "@/lib/posts";
import { THEMES, fmtJst } from "@/lib/themes";
import { previewStores } from "@/lib/storeData";
import type { Flag } from "@/lib/compliance";
import { BatchReview, type ReviewPost } from "./BatchReview";

export const dynamic = "force-dynamic";
// AI 作成・画像生成を小分けに実行するため
export const maxDuration = 120;

export default async function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [batch, preview, report] = await Promise.all([
    prisma.postBatch.findUnique({
      where: { id },
      include: {
        posts: {
          include: { store: true, deliveries: true },
          orderBy: [{ store: { sortOrder: "asc" } }, { store: { name: "asc" } }],
        },
      },
    }),
    previewStores(),
    prisma.analysisReport.findFirst({ where: { status: "done" }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!batch) notFound();

  const posts: ReviewPost[] = batch.posts.map((p) => ({
    id: p.id,
    storeName: p.store.name,
    storeArea: [p.store.city, p.store.area].filter(Boolean).join(" "),
    channels: storeChannels(p.store),
    gbpText: p.gbpText,
    igCaption: p.igCaption,
    imageUrl: p.imageUrl ?? "",
    videoUrl: p.videoUrl,
    status: p.status,
    flags: p.flags as Flag[],
    error: p.error,
    deliveries: p.deliveries.map((d) => ({ channel: d.channel, status: d.status, error: d.error })),
  }));

  return (
    <BatchReview
      batch={{
        id: batch.id,
        when: fmtJst(batch.scheduledAt),
        theme: batch.theme,
        memo: batch.memo,
        mode: batch.mode,
        gbpTemplate: batch.gbpTemplate,
        igTemplate: batch.igTemplate,
        mediaType: batch.mediaType,
        headline: batch.headline,
        bgPrompt: batch.bgPrompt,
        bgImageUrl: batch.bgImageUrl,
      }}
      posts={posts}
      preview={preview}
      themeIdeas={[...(report?.themeIdeas ?? []), ...THEMES]}
    />
  );
}
