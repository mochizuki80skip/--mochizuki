import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateAvailability } from "@/lib/reservation";
import { computeDbAvailability } from "@/lib/availabilityDb";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;
  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");
  const visitType = url.searchParams.get("visitType"); // "new" | "returning"（シート連動モード）
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");

  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "missing params" }, { status: 400 });
  }

  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
  });
  if (!settings?.isEnabled) {
    return NextResponse.json({ error: "reservations not enabled" }, { status: 404 });
  }

  // === シート連動モード（DB ベースの日次ベッドで空き計算）===
  if (settings.sheetLinkedMode) {
    const vt = visitType === "new" ? "new" : "returning";
    try {
      const days = await computeDbAvailability({ channelId, visitType: vt, fromDate, toDate });
      return NextResponse.json({ mode: "db-clinic", days });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "unknown" },
        { status: 400 },
      );
    }
  }

  // === 従来 DB モード（メニュー予約）===
  if (!serviceId) {
    return NextResponse.json({ error: "missing serviceId" }, { status: 400 });
  }
  try {
    const days = await calculateAvailability({ channelId, serviceId, fromDate, toDate });
    const serializable = days.map((d) => ({
      ...d,
      slots: d.slots.map((s) => ({
        ...s,
        startAt: s.startAt.toISOString(),
        endAt: s.endAt.toISOString(),
      })),
    }));
    return NextResponse.json({ mode: "db", days: serializable });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "unknown" },
      { status: 400 },
    );
  }
}
