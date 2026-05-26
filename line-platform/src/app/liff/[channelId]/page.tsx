import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CalendarApp } from "./CalendarApp";
import { ClinicCalendarApp } from "./ClinicCalendarApp";

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

  const common = {
    channelId,
    liffId: settings.liffId ?? "",
    themeColor: settings.themeColor,
    clinicName: settings.clinicName ?? settings.lineChannel.name,
    clinicAddress: settings.clinicAddress ?? "",
    clinicPhone: settings.clinicPhone ?? "",
    bookingHorizonDays: settings.bookingHorizonDays,
  };

  if (settings.sheetLinkedMode) {
    return (
      <ClinicCalendarApp
        {...common}
        newDurationMin={settings.newPatientDurationMinutes}
        returningDurationMin={settings.returningDurationMinutes}
        lowStockThreshold={settings.lowStockThreshold}
      />
    );
  }

  return <CalendarApp {...common} />;
}
