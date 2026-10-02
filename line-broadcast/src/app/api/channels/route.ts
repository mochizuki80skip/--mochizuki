import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { verifyChannelCredentials, invalidateClientCache } from "@/lib/line";

const Body = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#06C755"),
  channelAccessToken: z.string().min(10),
  channelSecret: z.string().min(10),
});

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = Body.parse(await req.json());

  // LINE 側で実際に通信できることを検証
  const verify = await verifyChannelCredentials(body.channelAccessToken, body.channelSecret);
  if (!verify.ok) {
    return NextResponse.json(
      { error: `LINE への接続に失敗しました: ${verify.message}` },
      { status: 400 },
    );
  }

  const channel = await prisma.lineChannel.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      color: body.color,
      channelAccessToken: body.channelAccessToken,
      channelSecret: body.channelSecret,
    },
  });
  invalidateClientCache(channel.id);
  return NextResponse.json({ ok: true, id: channel.id });
}
