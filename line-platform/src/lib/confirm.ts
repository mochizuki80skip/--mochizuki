// 確定処理：問い合わせ → 確定予約を作成 + スプレッドシート当日タブを再生成（保険）
import { prisma } from "@/lib/prisma";
import { regenerateDailyTab } from "@/lib/dailyTab";

function jstDateTime(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time.length === 4 ? "0" + time : time}:00+09:00`);
}

export async function confirmReservation(params: {
  channelId: string;
  inquiryId: string;
  date: string;
  time: string;
  bedNumber: number;
}): Promise<{ ok: true; reservationId: string } | { ok: false; error: string }> {
  const { channelId, inquiryId, date, time, bedNumber } = params;

  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, lineChannelId: channelId },
  });
  if (!inquiry) return { ok: false, error: "問い合わせが見つかりません" };

  const settings = await prisma.reservationSettings.findUniqueOrThrow({
    where: { lineChannelId: channelId },
  });
  const isNew = inquiry.visitType === "new";
  const duration = isNew ? settings.newPatientDurationMinutes : settings.returningDurationMinutes;
  const startAt = jstDateTime(date, time);
  const endAt = new Date(startAt.getTime() + duration * 60_000);

  // 担当者名（日次ベッドから）
  const bed = await prisma.dailyBed.findUnique({
    where: { lineChannelId_date_bedNumber: { lineChannelId: channelId, date, bedNumber } },
  });
  const therapistName = bed?.therapistName ?? null;

  // 二重予約チェック（同ベッド・時間重複）
  const result = await prisma.$transaction(async (tx) => {
    const conflict = await tx.reservation.count({
      where: {
        lineChannelId: channelId,
        status: "confirmed",
        bedNumber,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (conflict > 0) return { conflict: true as const };

    let friendId: string | null = null;
    if (inquiry.lineUserId) {
      const f = await tx.friend.findUnique({
        where: { lineChannelId_lineUserId: { lineChannelId: channelId, lineUserId: inquiry.lineUserId } },
      });
      friendId = f?.id ?? null;
    }

    const created = await tx.reservation.create({
      data: {
        lineChannelId: channelId,
        serviceName: isNew ? "新規" : "2回目以降",
        durationMinutes: duration,
        startAt,
        endAt,
        customerName: inquiry.customerName,
        customerPhone: inquiry.customerPhone,
        referralSource: inquiry.referralSource,
        visitType: inquiry.visitType,
        bedNumber,
        therapistName,
        inquiryId: inquiry.id,
        lineUserId: inquiry.lineUserId,
        friendId,
        status: "confirmed",
      },
    });
    await tx.inquiry.update({ where: { id: inquiry.id }, data: { status: "handled" } });
    return { conflict: false as const, reservation: created };
  });

  if (result.conflict) return { ok: false, error: "そのベッド・時間は既に予約があります" };

  // スプレッドシート当日タブを再生成（保険・best effort）
  try {
    await regenerateDailyTab(channelId, date);
  } catch (e) {
    console.error("[confirm] sheet write failed:", e);
  }

  return { ok: true, reservationId: result.reservation.id };
}
