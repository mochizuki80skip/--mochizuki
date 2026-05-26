// 確定予約のキャンセル
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const Body = z.object({
  status: z.enum(["confirmed", "cancelled", "no_show"]),
  cancelReason: z.string().max(200).optional(),
});

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

  const updated = await prisma.reservation.updateMany({
    where: { id: reservationId, lineChannelId: id },
    data: {
      status,
      cancelledAt: status === "confirmed" ? null : new Date(),
      cancelReason: status === "confirmed" ? null : (cancelReason ?? null),
    },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
