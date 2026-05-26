// 確定処理：問い合わせ → 確定予約を作成 + スプレッドシート日付タブへ書き出し（保険）
import { prisma } from "@/lib/prisma";
import { findDayTab } from "@/lib/clinicSheet";
import { readRange, writeRange } from "@/lib/sheets";

const DAILY_NAME_ROW = 6; // 当日タブ：施術者名の行（時間行はこの下から）

function jstDateTime(dateStr: string, time: string): Date {
  return new Date(`${dateStr}T${time.length === 4 ? "0" + time : time}:00+09:00`);
}
function bedColumn(bedNumber: number): number {
  // 1-based 列番号。ベッド1=B(2), 2=E(5), 3=H(8)...（3列ごと）
  return 2 + (bedNumber - 1) * 3;
}
function columnLetter(col: number): string {
  let s = "";
  while (col > 0) {
    const r = (col - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
function normTime(s: string): string {
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? `${parseInt(m[1], 10)}:${m[2]}` : String(s).trim();
}

// 当日タブの時間行（1-based）を返す
async function findTimeRow(spreadsheetId: string, tabName: string, time: string): Promise<number> {
  const vals = await readRange(spreadsheetId, `${tabName}!A1:A200`);
  const target = normTime(time);
  for (let i = DAILY_NAME_ROW; i < vals.length; i++) {
    if (normTime(vals[i]?.[0] ?? "") === target) return i + 1;
  }
  return -1;
}

// スプレッドシート日付タブへ予約を書き出す（best effort）
async function writeToDailyTab(
  channelId: string,
  date: string,
  time: string,
  bedNumber: number,
  name: string,
  phone: string,
  kikkake: string | null,
  isNew: boolean,
): Promise<void> {
  const settings = await prisma.reservationSettings.findUnique({ where: { lineChannelId: channelId } });
  if (!settings?.spreadsheetId) return;
  const tab = await findDayTab(settings.spreadsheetId, date);
  if (!tab) return; // 当日タブが無ければスキップ
  const row = await findTimeRow(settings.spreadsheetId, tab, time);
  if (row < 0) return;
  const col = bedColumn(bedNumber);
  const colL = columnLetter(col);
  const colKL = columnLetter(col + 1);
  // 名前・電話（名前の下）
  await writeRange(settings.spreadsheetId, `${tab}!${colL}${row}:${colL}${row + 1}`, [[name], [phone]]);
  if (isNew && kikkake) {
    await writeRange(settings.spreadsheetId, `${tab}!${colKL}${row}`, [[kikkake]]);
  }
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

  // スプレッドシートへ書き出し（保険・best effort）
  try {
    await writeToDailyTab(
      channelId, date, time, bedNumber,
      inquiry.customerName, inquiry.customerPhone, inquiry.referralSource, isNew,
    );
  } catch (e) {
    console.error("[confirm] sheet write failed:", e);
  }

  return { ok: true, reservationId: result.reservation.id };
}
