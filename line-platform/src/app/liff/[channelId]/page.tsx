import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CalendarApp } from "./CalendarApp";
import { ClinicCalendarApp } from "./ClinicCalendarApp";
import { ensureBasicId } from "@/lib/line";

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

  // シート連動モードなら基本IDを取得（oaMessage/送信判定用）
  let lineBasicId = settings.lineChannel.lineBasicId;
  if (settings.sheetLinkedMode && !lineBasicId) {
    lineBasicId = await ensureBasicId(channelId).catch(() => null);
  }

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
        clinicPhotoUrl={settings.clinicPhotoUrl ?? ""}
        newDurationMin={settings.newPatientDurationMinutes}
        returningDurationMin={settings.returningDurationMinutes}
        lowStockThreshold={settings.lowStockThreshold}
        lineBasicId={lineBasicId ?? ""}
      />
    );
  }

  return <CalendarApp {...common} />;
}
