import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAvailability } from "@/lib/reservation";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");

  if (!serviceId || !fromDate || !toDate) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
    select: { isEnabled: true, bookingHorizonDays: true },
  });
  if (!settings?.isEnabled) {
    return NextResponse.json({ error: "reservations not enabled" }, { status: 404 });
  }

  try {
    const days = await calculateAvailability({ channelId, serviceId, fromDate, toDate });
    // Date を ISO 文字列に
    const serializable = days.map((d) => ({
      ...d,
      slots: d.slots.map((s) => ({
        ...s,
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
      })),
    }));
    return NextResponse.json({ days: serializable });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 400 },
    );
  }
}
