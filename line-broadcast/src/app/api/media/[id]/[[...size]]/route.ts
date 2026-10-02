import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// LINE（imagemap は /api/media/{id}/1040 のようにサイズ違いを要求する）と管理画面から取得される。
// ID は推測困難な cuid。サイズ違いは同じ画像を返す（アップロード時に 1040px 幅へ縮小済み）。
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await prisma.media.findUnique({ where: { id } });
  if (!m) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(m.data), {
    headers: {
      "content-type": m.contentType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
