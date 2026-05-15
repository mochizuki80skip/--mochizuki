// 予約システム：空き状況計算と予約作成

import { prisma } from "@/lib/prisma";
import { appendRow } from "@/lib/sheets";
import { syncAllTabs } from "@/lib/sheetSync";

// "HH:MM" を minutes に変換
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

// JST 日付ユーティリティ
function isoDate(d: Date): string {
  // JST に補正してから YYYY-MM-DD を返す
  const jst = new Date(d.getTime() + 9 * 60 * 60_000);
  return jst.toISOString().slice(0, 10);
}

function jstDayOfWeek(d: Date): number {
  const jst = new Date(d.getTime() + 9 * 60 * 60_000);
  return jst.getUTCDay(); // 0=日, 6=土
}

// JST 日付 + "HH:MM" → UTC Date
function buildJstDateTime(dateStr: string, time: string): Date {
  // dateStr "YYYY-MM-DD", time "HH:MM" を JST と解釈 → UTC に変換
  return new Date(`${dateStr}T${time}:00+09:00`);
}

export type Slot = {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  startAt: Date;
  endAt: Date;
  available: boolean;
  remainingCapacity: number;
};

export type DayAvailability = {
  date: string;
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
  slots: Slot[];
};

// 指定期間の空き状況を計算
export async function calculateAvailability(params: {
  channelId: string;
  serviceId: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;   // YYYY-MM-DD
}): Promise<DayAvailability[]> {
  const { channelId, serviceId, fromDate, toDate } = params;

  // 設定取得
  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
  });
  if (!settings) throw new Error("予約設定が未作成です");
  const slotMinutes = settings.slotMinutes;
  const bedCount = settings.defaultBedCount;
  const leadMs = settings.bookingLeadHours * 3600_000;
  const now = new Date();
  const earliestAllowed = new Date(now.getTime() + leadMs);

  // メニュー取得
  const service = await prisma.service.findFirst({
    where: { id: serviceId, lineChannelId: channelId, isActive: true },
  });
  if (!service) throw new Error("メニューが見つかりません");
  const durationSlots = Math.ceil(service.durationMinutes / slotMinutes);

  // 営業時間
  const hoursRows = await prisma.businessHours.findMany({
    where: { lineChannelId: channelId },
  });
  const hoursByDay = new Map<number, { isClosed: boolean; open: string | null; close: string | null }>();
  for (const h of hoursRows) {
    hoursByDay.set(h.dayOfWeek, {
      isClosed: h.isClosed,
      open: h.openTime,
      close: h.closeTime,
    });
  }

  // 期間内の休業日
  const fromD = new Date(`${fromDate}T00:00:00+09:00`);
  const toD = new Date(`${toDate}T23:59:59+09:00`);
  const holidays = await prisma.holiday.findMany({
    where: { lineChannelId: channelId, date: { gte: fromD, lte: toD } },
  });
  const holidaySet = new Set(holidays.map((h) => isoDate(h.date)));

  // 期間内の既存予約
  const reservations = await prisma.reservation.findMany({
    where: {
      lineChannelId: channelId,
      status: "confirmed",
      startAt: { gte: fromD },
      endAt: { lte: toD },
    },
    select: { startAt: true, endAt: true },
  });

  // 結果組み立て
  const result: DayAvailability[] = [];
  for (let d = new Date(fromD); d <= toD; d.setUTCDate(d.getUTCDate() + 1)) {
    const dateStr = isoDate(d);
    const dow = jstDayOfWeek(d);
    const hours = hoursByDay.get(dow);
    const isClosed =
      !hours ||
      hours.isClosed ||
      !hours.open ||
      !hours.close ||
      holidaySet.has(dateStr);

    if (isClosed) {
      result.push({
        date: dateStr,
        dayOfWeek: dow,
        isClosed: true,
        openTime: hours?.open ?? null,
        closeTime: hours?.close ?? null,
        slots: [],
      });
      continue;
    }

    const openM = timeToMinutes(hours!.open!);
    const closeM = timeToMinutes(hours!.close!);
    const slots: Slot[] = [];

    // スロット生成：開店〜閉店から durationSlots 分前まで
    for (let m = openM; m + service.durationMinutes <= closeM; m += slotMinutes) {
      const slotTime = minutesToTime(m);
      const slotStart = buildJstDateTime(dateStr, slotTime);
      const slotEnd = new Date(slotStart.getTime() + service.durationMinutes * 60_000);

      // 受付制限：lead time
      if (slotStart < earliestAllowed) {
        slots.push({
          date: dateStr,
          time: slotTime,
          startAt: slotStart,
          endAt: slotEnd,
          available: false,
          remainingCapacity: 0,
        });
        continue;
      }

      // この slot 期間と重なる予約を数える
      const overlapping = reservations.filter(
        (r) => r.startAt < slotEnd && r.endAt > slotStart,
      ).length;
      const remaining = Math.max(0, bedCount - overlapping);
      slots.push({
        date: dateStr,
        time: slotTime,
        startAt: slotStart,
        endAt: slotEnd,
        available: remaining > 0,
        remainingCapacity: remaining,
      });
    }

    result.push({
      date: dateStr,
      dayOfWeek: dow,
      isClosed: false,
      openTime: hours!.open!,
      closeTime: hours!.close!,
      slots,
    });
  }
  return result;
}

// 予約作成（競合チェック付き）
export async function createReservation(params: {
  channelId: string;
  serviceId: string;
  startAt: Date; // 予約開始時刻
  customerName: string;
  customerPhone: string;
  referralSource?: string | null;
  lineUserId?: string | null;
  notes?: string | null;
}): Promise<{ ok: true; reservationId: string } | { ok: false; error: string }> {
  const { channelId, serviceId, startAt } = params;

  const service = await prisma.service.findFirst({
    where: { id: serviceId, lineChannelId: channelId, isActive: true },
  });
  if (!service) return { ok: false, error: "メニューが見つかりません" };

  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
  });
  if (!settings) return { ok: false, error: "予約設定が未作成です" };

  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60_000);
  const bedCount = settings.defaultBedCount;

  // トランザクションで競合チェック → 作成
  const result = await prisma.$transaction(async (tx) => {
    const overlapping = await tx.reservation.count({
      where: {
        lineChannelId: channelId,
        status: "confirmed",
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    });
    if (overlapping >= bedCount) {
      return { conflict: true as const };
    }

    // 既存友だちと紐付け
    let friendId: string | null = null;
    if (params.lineUserId) {
      const friend = await tx.friend.findUnique({
        where: {
          lineChannelId_lineUserId: {
            lineChannelId: channelId,
            lineUserId: params.lineUserId,
          },
        },
      });
      friendId = friend?.id ?? null;
    }

    const created = await tx.reservation.create({
      data: {
        lineChannelId: channelId,
        serviceId: service.id,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        price: service.price,
        startAt,
        endAt,
        customerName: params.customerName,
        customerPhone: params.customerPhone,
        referralSource: params.referralSource ?? null,
        lineUserId: params.lineUserId ?? null,
        friendId,
        notes: params.notes ?? null,
        status: "confirmed",
      },
    });
    return { conflict: false as const, reservation: created, settings };
  });

  if (result.conflict) {
    return { ok: false, error: "選択された時間枠は既に満員です。別の時間をお選びください。" };
  }

  // Sheet に追記（失敗してもエラー扱いにしない）
  if (result.settings.spreadsheetId) {
    try {
      const r = result.reservation;
      const startJst = new Date(r.startAt.getTime() + 9 * 60 * 60_000);
      const dateStr = startJst.toISOString().slice(0, 10);
      const timeStr = startJst.toISOString().slice(11, 16);
      const { rowNumber } = await appendRow(
        result.settings.spreadsheetId,
        result.settings.sheetTabReservations,
        [
          r.id,
          `${dateStr} ${timeStr}`,
          r.serviceName,
          r.durationMinutes,
          r.customerName,
          r.customerPhone,
          r.referralSource ?? "",
          r.lineUserId ?? "",
          r.status,
          new Date(r.createdAt.getTime() + 9 * 60 * 60_000).toISOString().slice(0, 19).replace("T", " "),
        ],
      );
      if (rowNumber) {
        await prisma.reservation.update({
          where: { id: r.id },
          data: { sheetRowNumber: rowNumber },
        });
      }
    } catch (e) {
      console.error("[reservation] Sheets append failed:", e);
    }
    // スケジュールタブも更新（失敗しても予約自体は成功扱い）
    try {
      await syncAllTabs(channelId);
    } catch (e) {
      console.error("[reservation] Schedule sync failed:", e);
    }
  }

  return { ok: true, reservationId: result.reservation.id };
}
