import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CalendarApp } from "./CalendarApp";

export const dynamic = "force-dynamic";

export default async function LiffPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
    include: { lineChannel: true },
  });

  if (!settings || !settings.isEnabled) notFound();

  return (
    <CalendarApp
      channelId={channelId}
      liffId={settings.liffId ?? ""}
      themeColor={settings.themeColor}
      clinicName={settings.clinicName ?? settings.lineChannel.name}
      clinicAddress={settings.clinicAddress ?? ""}
      clinicPhone={settings.clinicPhone ?? ""}
      bookingHorizonDays={settings.bookingHorizonDays}
    />
  );
}
