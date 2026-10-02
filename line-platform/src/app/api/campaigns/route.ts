import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, listAccessibleChannels } from "@/lib/permissions";
import { Blocks, buildMessages } from "@/lib/campaign-blocks";
import { executeCampaignBroadcasts } from "@/lib/campaign";
import { publicBaseUrl } from "@/lib/base-url";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(120),
  blocks: Blocks,
  channelIds: z.array(z.string()).min(1, "配信するアカウントを選択してください").max(50),
  // 空配列 = 全員。タグは各アカウントのタグを「名前」で突き合わせる
  tagNames: z.array(z.string().trim().min(1)).max(50).default([]),
  mode: z.enum(["now", "schedule", "draft"]),
  scheduledAt: z.string().datetime().optional(), // ISO 8601（ブラウザ側でタイムゾーン付きに変換して送る）
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
  }
  const body = parsed.data;

  let scheduledAt: Date | null = null;
  if (body.mode === "schedule") {
    if (!body.scheduledAt) return NextResponse.json({ error: "配信日時を指定してください" }, { status: 400 });
    scheduledAt = new Date(body.scheduledAt);
    if (scheduledAt.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: "配信日時が過去です" }, { status: 400 });
    }
  }

  // 権限のあるアカウントのみに限定（他人のアカウントを指定されても弾く）
  const accessible = await listAccessibleChannels(user.id, user.role);
  const accessibleIds = new Set(accessible.map((c) => c.id));
  const channelIds = [...new Set(body.channelIds)];
  if (channelIds.some((id) => !accessibleIds.has(id))) {
    return NextResponse.json({ error: "権限のないアカウントが含まれています" }, { status: 403 });
  }

  let messages: Record<string, unknown>[];
  try {
    messages = buildMessages(body.blocks, publicBaseUrl(req));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const tagNames = [...new Set(body.tagNames)];
  const tags = tagNames.length
    ? await prisma.tag.findMany({
        where: { lineChannelId: { in: channelIds }, name: { in: tagNames } },
        select: { id: true, name: true, lineChannelId: true },
      })
    : [];

  const campaign = await prisma.campaign.create({
    data: {
      title: body.title,
      blocks: body.blocks,
      messages: messages as object[],
      audienceTagNames: tagNames,
      scheduledAt,
      createdById: user.id,
    },
  });

  for (const channelId of channelIds) {
    const chTags = tags.filter((t) => t.lineChannelId === channelId);
    // タグ指定なのにこのアカウントに該当タグが無い場合は、全員に送ってしまわないよう「対象なし」にする
    const noAudience = tagNames.length > 0 && chTags.length === 0;
    await prisma.broadcast.create({
      data: {
        lineChannelId: channelId,
        campaignId: campaign.id,
        title: body.title,
        messages: messages as object[],
        targetAllFollowers: tagNames.length === 0,
        scheduledAt,
        status: noAudience
          ? "skipped"
          : body.mode === "schedule"
            ? "scheduled"
            : "draft",
        errorMessage: noAudience ? "指定したタグがこのアカウントに存在しないため配信しませんでした" : null,
        tags: { create: chTags.map((t) => ({ tagId: t.id })) },
      },
    });
  }

  if (body.mode === "now") {
    const results = await executeCampaignBroadcasts(campaign.id);
    return NextResponse.json({ ok: true, campaignId: campaign.id, results });
  }
  return NextResponse.json({ ok: true, campaignId: campaign.id });
}
