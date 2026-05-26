import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CalendarApp } from "./CalendarApp";
import { ClinicCalendarApp } from "./ClinicCalendarApp";
import { ensureBasicId } from "@/lib/line";
import { ensureDefaultReferrals } from "@/lib/defaultReferrals";

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

  // シート連動モードなら：基本ID取得 + きっかけ既定投入（初回のみ）
  let lineBasicId = settings.lineChannel.lineBasicId;
  if (settings.sheetLinkedMode) {
    if (!lineBasicId) {
      lineBasicId = await ensureBasicId(channelId).catch(() => null);
    }
    await ensureDefaultReferrals(channelId).catch(() => {});
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
        newDurationMin={settings.newPatientDurationMinutes}
        returningDurationMin={settings.returningDurationMinutes}
        lowStockThreshold={settings.lowStockThreshold}
        lineBasicId={lineBasicId ?? ""}
      />
    );
  }

  return <CalendarApp {...common} />;
}
