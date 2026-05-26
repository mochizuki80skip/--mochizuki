import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessChannel } from "@/lib/permissions";
import { GeneralSettings } from "./GeneralSettings";
import { ServicesSettings } from "./ServicesSettings";
import { HoursSettings } from "./HoursSettings";
import { ReferralSettings } from "./ReferralSettings";
import { SheetsSettings } from "./SheetsSettings";
import { SheetLinkedSettings } from "./SheetLinkedSettings";
import { AvailabilityUrl } from "./AvailabilityUrl";

export const dynamic = "force-dynamic";

export default async function ReservationSettingsPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ok = await canAccessChannel(user.id, user.role, channelId);
  if (!ok) redirect("/dashboard");

  // 設定の自動作成（未作成なら既定値）
  const settings = await prisma.reservationSettings.upsert({
    where: { lineChannelId: channelId },
    create: { lineChannelId: channelId },
    update: {},
  });

  // 営業時間の既定値（未作成なら全日定休）
  const hoursCount = await prisma.businessHours.count({ where: { lineChannelId: channelId } });
  if (hoursCount === 0) {
    await prisma.businessHours.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map((dow) => ({
        lineChannelId: channelId,
        dayOfWeek: dow,
        isClosed: true,
      })),
    });
  }

  const [services, hours, referrals] = await Promise.all([
    prisma.service.findMany({
      where: { lineChannelId: channelId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.businessHours.findMany({
      where: { lineChannelId: channelId },
      orderBy: { dayOfWeek: "asc" },
    }),
    prisma.referralSource.findMany({
      where: { lineChannelId: channelId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">予約設定</h1>

      <AvailabilityUrl channelId={channelId} liffId={settings.liffId ?? ""} />

      <GeneralSettings
        channelId={channelId}
        sheetMode={settings.sheetLinkedMode}
        initial={{
          isEnabled: settings.isEnabled,
          slotMinutes: settings.slotMinutes,
          defaultBedCount: settings.defaultBedCount,
          bookingHorizonDays: settings.bookingHorizonDays,
          bookingLeadHours: settings.bookingLeadHours,
          clinicName: settings.clinicName ?? "",
          clinicAddress: settings.clinicAddress ?? "",
          clinicPhone: settings.clinicPhone ?? "",
          clinicPhotoUrl: settings.clinicPhotoUrl ?? "",
          themeColor: settings.themeColor,
          liffId: settings.liffId ?? "",
          sendConfirmMessage: settings.sendConfirmMessage,
          confirmMessageTemplate: settings.confirmMessageTemplate ?? "",
        }}
      />

      <SheetLinkedSettings
        channelId={channelId}
        initial={{
          sheetLinkedMode: settings.sheetLinkedMode,
          sheetTabInquiry: settings.sheetTabInquiry,
          newPatientDurationMinutes: settings.newPatientDurationMinutes,
          returningDurationMinutes: settings.returningDurationMinutes,
          lowStockThreshold: settings.lowStockThreshold,
          inquiryReplyMessage: settings.inquiryReplyMessage ?? "",
        }}
      />

      {/* DB モード専用（シート連動モードでは非表示） */}
      {!settings.sheetLinkedMode && (
        <>
          <ServicesSettings
            channelId={channelId}
            initial={services.map((s) => ({
              id: s.id,
              name: s.name,
              durationMinutes: s.durationMinutes,
              price: s.price,
              sortOrder: s.sortOrder,
              isActive: s.isActive,
            }))}
            slotMinutes={settings.slotMinutes}
          />

          <HoursSettings
            channelId={channelId}
            initial={hours.map((h) => ({
              dayOfWeek: h.dayOfWeek,
              isClosed: h.isClosed,
              openTime: h.openTime ?? "",
              closeTime: h.closeTime ?? "",
            }))}
          />
        </>
      )}

      <ReferralSettings
        channelId={channelId}
        initial={referrals.map((r) => ({
          id: r.id,
          name: r.name,
          sortOrder: r.sortOrder,
          isActive: r.isActive,
        }))}
      />

      <SheetsSettings
        channelId={channelId}
        sheetMode={settings.sheetLinkedMode}
        initial={{
          spreadsheetId: settings.spreadsheetId ?? "",
          sheetTabReservations: settings.sheetTabReservations,
        }}
      />
    </div>
  );
}
