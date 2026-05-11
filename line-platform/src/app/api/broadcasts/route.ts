import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { executeBroadcast } from "@/lib/broadcast";

const Body = z.object({
  title: z.string().min(1).max(120),
  messages: z.array(z.record(z.any())).min(1).max(5),
  tagIds: z.array(z.string()).default([]),
  targetAllFollowers: z.boolean().default(true),
  scheduledAt: z.string().optional(),
  sendNow: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = Body.parse(await req.json());
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;

  const status = body.sendNow ? "draft" : scheduledAt ? "scheduled" : "draft";

  const broadcast = await prisma.broadcast.create({
    data: {
      title: body.title,
      messages: body.messages,
      targetAllFollowers: body.targetAllFollowers && body.tagIds.length === 0,
      scheduledAt,
      status,
      tags: {
        create: body.tagIds.map((tagId) => ({ tagId })),
      },
    },
  });

  if (body.sendNow) {
    // 同期で送る（数件なら問題なし。大量はワーカー側で）
    try {
      await executeBroadcast(broadcast.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      return NextResponse.json({ error: msg, broadcastId: broadcast.id }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, broadcastId: broadcast.id });
}
