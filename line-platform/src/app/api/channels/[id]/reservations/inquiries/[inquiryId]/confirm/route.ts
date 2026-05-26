// 問い合わせを確定予約に変換（管理画面で日時・ベッドを指定）
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireChannel } from "@/lib/permissions";
import { confirmReservation } from "@/lib/confirm";

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{1,2}:\d{2}$/),
  bedNumber: z.number().int().min(1).max(50),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; inquiryId: string }> },
) {
  const { id, inquiryId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const { date, time, bedNumber } = Body.parse(await req.json());

  const result = await confirmReservation({ channelId: id, inquiryId, date, time, bedNumber });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, reservationId: result.reservationId });
}
