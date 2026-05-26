import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pushTo } from "@/lib/line";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// スプレッドシート（Apps Script）など外部から LINE メッセージを送るための連携エンドポイント。
// CRON_SECRET で認証する。

const Body = z.object({
  channelId: z.string(),
  lineUserId: z.string().min(1),
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const channel = await prisma.lineChannel.findUnique({ where: { id: body.channelId } });
  if (!channel) return NextResponse.json({ error: "channel not found" }, { status: 404 });

  try {
    await pushTo(body.channelId, body.lineUserId, [{ type: "text", text: body.message }]);
    await prisma.deliveryLog
      .create({ data: { lineChannelId: body.channelId, channel: "manual", status: "success" } })
      .catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "send failed" },
      { status: 500 },
    );
  }
}
