// 確定予約のキャンセル
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import { regenerateDailyTab } from "@/lib/dailyTab";

const Body = z.object({
  status: z.enum(["confirmed", "cancelled", "no_show"]),
  cancelReason: z.string().max(200).optional(),
});

function jstDate(d: Date): string {
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reservationId: string }> },
) {
  const { id, reservationId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const { status, cancelReason } = Body.parse(await req.json());

  const existing = await prisma.reservation.findFirst({
    where: { id: reservationId, lineChannelId: id },
    select: { startAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: {
      status,
      cancelledAt: status === "confirmed" ? null : new Date(),
      cancelReason: status === "confirmed" ? null : (cancelReason ?? null),
    },
  });

  // スプレッドシート当日タブを再生成（best effort）
  try {
    await regenerateDailyTab(id, jstDate(existing.startAt));
  } catch (e) {
    console.error("[reservation] sheet regen failed:", e);
  }

  return NextResponse.json({ ok: true });
}
