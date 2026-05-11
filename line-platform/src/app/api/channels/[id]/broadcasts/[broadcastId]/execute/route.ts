import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import { executeBroadcast } from "@/lib/broadcast";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; broadcastId: string }> },
) {
  const { id, broadcastId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  // チャネル境界チェック
  const b = await prisma.broadcast.findFirst({ where: { id: broadcastId, lineChannelId: id } });
  if (!b) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await executeBroadcast(broadcastId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 500 },
    );
  }
}
