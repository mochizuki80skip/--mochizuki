import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAccessChannel, getCurrentUser } from "@/lib/permissions";
import { executeBroadcast } from "@/lib/broadcast";

// 複数の LINE アカウントに同じ内容を一斉配信する。
// アカウントごとに Broadcast を 1 件ずつ作成し、既存の配信処理（予約はワーカー）に載せる。
const Body = z.object({
  channelIds: z.array(z.string()).min(1),
  title: z.string().min(1).max(120),
  messages: z.array(z.record(z.any())).min(1).max(5),
  scheduledAt: z.string().optional(),
  sendNow: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = Body.parse(await req.json());
  const channelIds = [...new Set(body.channelIds)];
  for (const id of channelIds) {
    if (!(await canAccessChannel(user.id, user.role, id))) {
      return NextResponse.json({ error: `forbidden: ${id}` }, { status: 403 });
    }
  }

  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const status = body.sendNow ? "draft" : scheduledAt ? "scheduled" : "draft";

  const results: { channelId: string; broadcastId: string; ok: boolean; error?: string }[] = [];
  for (const channelId of channelIds) {
    const b = await prisma.broadcast.create({
      data: {
        lineChannelId: channelId,
        title: body.title,
        messages: body.messages,
        targetAllFollowers: true,
        scheduledAt,
        status,
      },
    });
    if (!body.sendNow) {
      results.push({ channelId, broadcastId: b.id, ok: true });
      continue;
    }
    try {
      await executeBroadcast(b.id);
      results.push({ channelId, broadcastId: b.id, ok: true });
    } catch (e) {
      results.push({ channelId, broadcastId: b.id, ok: false, error: e instanceof Error ? e.message : "unknown" });
    }
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json({ ok: failed.length === 0, results }, { status: failed.length ? 207 : 200 });
}
