import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createReservation } from "@/lib/reservation";

export const dynamic = "force-dynamic";

const Body = z.object({
  serviceId: z.string(),
  startAt: z.string(), // ISO string
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(1).max(50),
  referralSource: z.string().max(120).nullable().optional(),
  lineUserId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;
  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
    select: { isEnabled: true },
  });
  if (!settings?.isEnabled) {
    return NextResponse.json({ error: "reservations not enabled" }, { status: 404 });
  }

  let body;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const startAt = new Date(body.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "invalid startAt" }, { status: 400 });
  }

  const result = await createReservation({
    channelId,
    serviceId: body.serviceId,
    startAt,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    referralSource: body.referralSource ?? null,
    lineUserId: body.lineUserId ?? null,
    notes: body.notes ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, reservationId: result.reservationId });
}
