import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
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
  const services = await prisma.service.findMany({
    where: { lineChannelId: channelId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, durationMinutes: true, price: true, description: true },
  });
  return NextResponse.json({ services });
}
