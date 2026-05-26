// DB ベースの空き状況計算（日次ベッド担当 − 確定予約）
// シート連動モードの接骨院向け。日替わりのベッド担当に対応。

import { prisma } from "@/lib/prisma";

function isoDate(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60_000);
  return jst.toISOString().slice(0, 10);
}
function jstDow(d: Date): number {
  return new Date(d.getTime() + 9 * 60 * 60_000).getUTCDay();
}
function tToM(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function mToT(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function jstDateTime(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time.length === 4 ? "0" + time : time}:00+09:00`);
}

export type DbSlot = {
  date: string;
  time: string;
  startAt: string;
  endAt: string;
  available: boolean;
  remainingCapacity: number;
};
export type DbDay = {
  date: string;
  dayOfWeek: number;
  isClosed: boolean;
  slots: DbSlot[];
};

// 営業時間（曜日ベース）から、その日の開店/閉店を返す
async function getDayHours(channelId: string, dow: number) {
  const h = await prisma.businessHours.findUnique({
    where: { lineChannelId_dayOfWeek: { lineChannelId: channelId, dayOfWeek: dow } },
  });
  if (!h || h.isClosed || !h.openTime || !h.closeTime) return null;
  return { open: h.openTime, close: h.closeTime };
}

export async function computeDbAvailability(params: {
  channelId: string;
  visitType: "new" | "returning";
  fromDate: string;
  toDate: string;
}): Promise<DbDay[]> {
  const { channelId, visitType } = params;
  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
  });
  if (!settings) throw new Error("予約設定が未作成です");

  const slotMin = settings.slotMinutes || 15;
  const duration =
    visitType === "new" ? settings.newPatientDurationMinutes : settings.returningDurationMinutes;
  const needed = Math.max(1, Math.ceil(duration / slotMin));
  const leadMs = settings.bookingLeadHours * 3600_000;
  const earliest = new Date(Date.now() + leadMs);

  const from = new Date(`${params.fromDate}T00:00:00+09:00`);
  const to = new Date(`${params.toDate}T23:59:59+09:00`);

  // 期間内の日次ベッド
  const beds = await prisma.dailyBed.findMany({
    where: { lineChannelId: channelId, date: { gte: params.fromDate, lte: params.toDate } },
  });
  const bedsByDate = new Map<string, typeof beds>();
  for (const b of beds) {
    const arr = bedsByDate.get(b.date) ?? [];
    arr.push(b);
    bedsByDate.set(b.date, arr);
  }

  // 期間内の確定予約
  const reservations = await prisma.reservation.findMany({
    where: {
      lineChannelId: channelId,
      status: "confirmed",
      startAt: { gte: from },
      endAt: { lte: to },
    },
    select: { startAt: true, endAt: true, bedNumber: true },
  });

  const holidays = await prisma.holiday.findMany({
    where: { lineChannelId: channelId, date: { gte: from, lte: to } },
  });
  const holidaySet = new Set(holidays.map((h) => isoDate(h.date)));

  // 期間内の日次営業時間（曜日既定を上書き）
  const dailyHours = await prisma.dailyHours.findMany({
    where: { lineChannelId: channelId, date: { gte: params.fromDate, lte: params.toDate } },
  });
  const dhByDate = new Map(dailyHours.map((h) => [h.date, { open: h.openTime, close: h.closeTime }]));

  // 期間内の休憩時間
  const breaks = await prisma.dailyBreak.findMany({
    where: { lineChannelId: channelId, date: { gte: params.fromDate, lte: params.toDate } },
  });
  const breaksByDate = new Map<string, { s: number; e: number }[]>();
  for (const b of breaks) {
    const arr = breaksByDate.get(b.date) ?? [];
    arr.push({ s: tToM(b.startTime), e: tToM(b.endTime) });
    breaksByDate.set(b.date, arr);
  }

  const days: DbDay[] = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400_000)) {
    const dateStr = isoDate(d);
    const dow = jstDow(d);
    const dayBeds = bedsByDate.get(dateStr) ?? [];
    const hours = dhByDate.get(dateStr) ?? (await getDayHours(channelId, dow));

    if (dayBeds.length === 0 || !hours || holidaySet.has(dateStr)) {
      days.push({ date: dateStr, dayOfWeek: dow, isClosed: true, slots: [] });
      continue;
    }

    // 対象ベッド（新規なら新規対応のみ）
    const targetBeds = dayBeds.filter((b) => (visitType === "new" ? b.acceptsNew : true));

    const openM = tToM(hours.open);
    const closeM = tToM(hours.close);
    const dayBreaks = breaksByDate.get(dateStr) ?? [];
    const slots: DbSlot[] = [];

    for (let m = openM; m + duration <= closeM; m += slotMin) {
      // 新規は :00 / :30 起点のみ
      if (visitType === "new" && m % 30 !== 0) continue;

      // 休憩時間と重なる枠は除外
      if (dayBreaks.some((br) => m < br.e && m + duration > br.s)) continue;

      const time = mToT(m);
      const slotStart = jstDateTime(dateStr, time);
      const slotEnd = new Date(slotStart.getTime() + duration * 60_000);

      if (slotStart < earliest) {
        slots.push({ date: dateStr, time, startAt: slotStart.toISOString(), endAt: slotEnd.toISOString(), available: false, remainingCapacity: 0 });
        continue;
      }

      // 各ベッドについて、duration 分（連続 needed 枠）が空いているか
      let remaining = 0;
      for (const bed of targetBeds) {
        const conflict = reservations.some(
          (r) => r.bedNumber === bed.bedNumber && r.startAt < slotEnd && r.endAt > slotStart,
        );
        if (!conflict) remaining++;
      }
      slots.push({
        date: dateStr,
        time,
        startAt: slotStart.toISOString(),
        endAt: slotEnd.toISOString(),
        available: remaining > 0,
        remainingCapacity: remaining,
      });
    }
    // 連続枠の判定は duration を slotEnd で見ているのでOK（ベッド単位で重複チェック済み）
    void needed;

    days.push({ date: dateStr, dayOfWeek: dow, isClosed: false, slots });
  }
  return days;
}

// 指定日時・新規可否で空いているベッド番号一覧（確定UI用）
export async function availableBedsAt(params: {
  channelId: string;
  date: string; // YYYY-MM-DD
  time: string; // H:MM
  visitType: "new" | "returning";
}): Promise<{ bedNumber: number; therapistName: string }[]> {
  const { channelId, date, time, visitType } = params;
  const settings = await prisma.reservationSettings.findUniqueOrThrow({
    where: { lineChannelId: channelId },
  });
  const duration =
    visitType === "new" ? settings.newPatientDurationMinutes : settings.returningDurationMinutes;
  const start = jstDateTime(date, time);
  const end = new Date(start.getTime() + duration * 60_000);

  const beds = await prisma.dailyBed.findMany({
    where: { lineChannelId: channelId, date },
    orderBy: { bedNumber: "asc" },
  });
  const reservations = await prisma.reservation.findMany({
    where: { lineChannelId: channelId, status: "confirmed", startAt: { lt: end }, endAt: { gt: start } },
    select: { bedNumber: true },
  });
  const busy = new Set(reservations.map((r) => r.bedNumber));
  return beds
    .filter((b) => (visitType === "new" ? b.acceptsNew : true))
    .filter((b) => !busy.has(b.bedNumber))
    .map((b) => ({ bedNumber: b.bedNumber, therapistName: b.therapistName }));
}
