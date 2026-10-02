import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import { executeBroadcast } from "@/lib/broadcast";

const Body = z.object({
  title: z.string().min(1).max(120),
  messages: z.array(z.record(z.any())).min(1).max(5),
  tagIds: z.array(z.string()).default([]),
  targetAllFollowers: z.boolean().default(true),
  scheduledAt: z.string().datetime().optional(), // タイムゾーン付き ISO 8601
  sendNow: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
  }
  const body = parsed.data;
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  if (scheduledAt && scheduledAt.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "予約日時が過去です" }, { status: 400 });
  }
  const status = body.sendNow ? "draft" : scheduledAt ? "scheduled" : "draft";

  const broadcast = await prisma.broadcast.create({
    data: {
      lineChannelId: id,
      title: body.title,
      messages: body.messages,
      targetAllFollowers: body.targetAllFollowers && body.tagIds.length === 0,
      scheduledAt,
      status,
      tags: { create: body.tagIds.map((tagId) => ({ tagId })) },
    },
  });

  if (body.sendNow) {
    try {
      await executeBroadcast(broadcast.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      return NextResponse.json({ error: msg, broadcastId: broadcast.id }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, broadcastId: broadcast.id });
}
