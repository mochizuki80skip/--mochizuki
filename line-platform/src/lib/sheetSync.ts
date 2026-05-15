// スプレッドシートとの双方向 / 全方位同期
// 「予約」タブは追記専用（appendRow）。それ以外のタブは regenerate 方式で上書き。

import { prisma } from "@/lib/prisma";
import {
  ensureSheetTabs,
  writeRange,
  clearTab,
  applyTabFormatting,
  applyScheduleFormatting,
} from "@/lib/sheets";

const DAYS_JP = ["日", "月", "火", "水", "木", "金", "土"];

// JST 日付ユーティリティ
function isoDate(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 60 * 60_000);
  return jst.toISOString().slice(0, 10);
}
function jstDayOfWeek(d: Date): number {
  const jst = new Date(d.getTime() + 9 * 60 * 60_000);
  return jst.getUTCDay();
}
function pad(n: number) { return n.toString().padStart(2, "0"); }
function tToM(t: string): number { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function mToT(m: number): string { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; }

const RESERVATIONS_HEADERS = [
  "予約ID", "予約日時", "メニュー", "所要時間(分)", "顧客名",
  "電話番号", "知ったきっかけ", "LINE userId", "状態", "登録日時",
];

// 「予約」タブ：ヘッダー行をセット（既存データはそのまま）
export async function ensureReservationsHeader(spreadsheetId: string, tabName: string) {
  await writeRange(spreadsheetId, `${tabName}!A1:J1`, [RESERVATIONS_HEADERS]);
  await applyTabFormatting(spreadsheetId, tabName, RESERVATIONS_HEADERS.length);
}

// 全タブを最新化（予約のデータは保持。スケジュール／設定／メニュー／営業時間／きっかけは再生成）
export async function syncAllTabs(channelId: string): Promise<void> {
  const settings = await prisma.reservationSettings.findUniqueOrThrow({
    where: { lineChannelId: channelId },
    include: { lineChannel: true },
  });
  if (!settings.spreadsheetId) throw new Error("スプレッドシートIDが未設定です");

  const spreadsheetId = settings.spreadsheetId;
  const tabSchedule = "スケジュール";
  const tabConfig = settings.sheetTabSettings;
  const tabMenu = settings.sheetTabMenu;
  const tabHours = settings.sheetTabHours;
  const tabReferral = settings.sheetTabReferral;
  const tabReservations = settings.sheetTabReservations;

  // タブを作成（無ければ）
  await ensureSheetTabs(spreadsheetId, [
    tabReservations, tabSchedule, tabConfig, tabMenu, tabHours, tabReferral,
  ]);

  // 「予約」ヘッダー
  await ensureReservationsHeader(spreadsheetId, tabReservations);

  // 「設定」タブ
  await writeConfigTab(spreadsheetId, tabConfig, settings);

  // 「メニュー」タブ
  const services = await prisma.service.findMany({
    where: { lineChannelId: channelId },
    orderBy: { sortOrder: "asc" },
  });
  await writeMenuTab(spreadsheetId, tabMenu, services);

  // 「営業時間」タブ
  const hours = await prisma.businessHours.findMany({
    where: { lineChannelId: channelId },
    orderBy: { dayOfWeek: "asc" },
  });
  await writeHoursTab(spreadsheetId, tabHours, hours);

  // 「きっかけ」タブ
  const referrals = await prisma.referralSource.findMany({
    where: { lineChannelId: channelId },
    orderBy: { sortOrder: "asc" },
  });
  await writeReferralTab(spreadsheetId, tabReferral, referrals);

  // 「スケジュール」タブ
  await writeScheduleTab(spreadsheetId, tabSchedule, channelId);
}

// 「設定」タブ
async function writeConfigTab(
  spreadsheetId: string,
  tab: string,
  settings: {
    defaultBedCount: number;
    slotMinutes: number;
    bookingHorizonDays: number;
    bookingLeadHours: number;
    clinicName: string | null;
    clinicAddress: string | null;
    clinicPhone: string | null;
    themeColor: string;
    isEnabled: boolean;
  },
) {
  await clearTab(spreadsheetId, tab);
  const rows: (string | number)[][] = [
    ["項目", "値"],
    ["予約機能有効", settings.isEnabled ? "ON" : "OFF"],
    ["ベッド数（同時受入）", settings.defaultBedCount],
    ["時間粒度（分）", settings.slotMinutes],
    ["受付：何日先まで", settings.bookingHorizonDays],
    ["受付締切：何時間前", settings.bookingLeadHours],
    ["院名", settings.clinicName ?? ""],
    ["住所", settings.clinicAddress ?? ""],
    ["電話番号", settings.clinicPhone ?? ""],
    ["アクセントカラー", settings.themeColor],
  ];
  await writeRange(spreadsheetId, `${tab}!A1:B${rows.length}`, rows);
  await applyTabFormatting(spreadsheetId, tab, 2);
}

// 「メニュー」タブ
async function writeMenuTab(
  spreadsheetId: string,
  tab: string,
  services: {
    id: string;
    name: string;
    durationMinutes: number;
    price: number;
    sortOrder: number;
    isActive: boolean;
  }[],
) {
  await clearTab(spreadsheetId, tab);
  const headers = ["ID", "名前", "所要時間(分)", "価格(円)", "並び", "有効"];
  const rows: (string | number)[][] = [headers];
  for (const s of services) {
    rows.push([
      s.id,
      s.name,
      s.durationMinutes,
      s.price,
      s.sortOrder,
      s.isActive ? "✓" : "",
    ]);
  }
  if (rows.length === 1) {
    rows.push(["", "（メニュー未登録）", "", "", "", ""]);
  }
  await writeRange(spreadsheetId, `${tab}!A1:F${rows.length}`, rows);
  await applyTabFormatting(spreadsheetId, tab, headers.length);
}

// 「営業時間」タブ
async function writeHoursTab(
  spreadsheetId: string,
  tab: string,
  hours: {
    dayOfWeek: number;
    isClosed: boolean;
    openTime: string | null;
    closeTime: string | null;
  }[],
) {
  await clearTab(spreadsheetId, tab);
  const headers = ["曜日", "営業/定休", "開店", "閉店"];
  const rows: (string | number)[][] = [headers];
  // 月曜始まりで表示
  const order = [1, 2, 3, 4, 5, 6, 0];
  const map = new Map(hours.map((h) => [h.dayOfWeek, h]));
  for (const dow of order) {
    const h = map.get(dow);
    rows.push([
      DAYS_JP[dow] + "曜",
      h?.isClosed ? "定休" : "営業",
      h?.isClosed ? "" : (h?.openTime ?? ""),
      h?.isClosed ? "" : (h?.closeTime ?? ""),
    ]);
  }
  await writeRange(spreadsheetId, `${tab}!A1:D${rows.length}`, rows);
  await applyTabFormatting(spreadsheetId, tab, headers.length);
}

// 「きっかけ」タブ
async function writeReferralTab(
  spreadsheetId: string,
  tab: string,
  referrals: { id: string; name: string; sortOrder: number; isActive: boolean }[],
) {
  await clearTab(spreadsheetId, tab);
  const headers = ["選択肢", "並び", "有効"];
  const rows: (string | number)[][] = [headers];
  for (const r of referrals) {
    rows.push([r.name, r.sortOrder, r.isActive ? "✓" : ""]);
  }
  if (rows.length === 1) {
    rows.push(["（選択肢未登録）", "", ""]);
  }
  await writeRange(spreadsheetId, `${tab}!A1:C${rows.length}`, rows);
  await applyTabFormatting(spreadsheetId, tab, headers.length);
}

// 「スケジュール」タブ：日 × 時間 のマトリクス（残ベッド数を表示）
async function writeScheduleTab(
  spreadsheetId: string,
  tab: string,
  channelId: string,
) {
  const settings = await prisma.reservationSettings.findUniqueOrThrow({
    where: { lineChannelId: channelId },
  });
  const days = Math.min(settings.bookingHorizonDays, 30); // Sheet パフォーマンス考慮で最大30日
  const slotMinutes = settings.slotMinutes;
  const bedCount = settings.defaultBedCount;

  const hours = await prisma.businessHours.findMany({ where: { lineChannelId: channelId } });
  const hoursByDay = new Map(hours.map((h) => [h.dayOfWeek, h]));

  // 期間
  const todayJstStr = isoDate(new Date());
  const today = new Date(`${todayJstStr}T00:00:00+09:00`);
  const endDate = new Date(today.getTime() + days * 86400_000);

  const holidays = await prisma.holiday.findMany({
    where: { lineChannelId: channelId, date: { gte: today, lte: endDate } },
  });
  const holidaySet = new Set(holidays.map((h) => isoDate(h.date)));

  const reservations = await prisma.reservation.findMany({
    where: {
      lineChannelId: channelId,
      status: "confirmed",
      startAt: { gte: today, lt: endDate },
    },
    select: { startAt: true, endAt: true },
  });

  // 全時間枠の集合（営業時間の和集合 = どの曜日でも開いている時間帯すべて）
  let minOpenM = 24 * 60;
  let maxCloseM = 0;
  for (const h of hours) {
    if (h.isClosed || !h.openTime || !h.closeTime) continue;
    minOpenM = Math.min(minOpenM, tToM(h.openTime));
    maxCloseM = Math.max(maxCloseM, tToM(h.closeTime));
  }
  if (minOpenM >= maxCloseM) {
    // 全日定休の場合
    await clearTab(spreadsheetId, tab);
    await writeRange(spreadsheetId, `${tab}!A1`, [
      ["スケジュールは営業時間未設定のため表示できません。"],
    ]);
    return;
  }
  const slotTimes: string[] = [];
  for (let m = minOpenM; m < maxCloseM; m += slotMinutes) {
    slotTimes.push(mToT(m));
  }

  // 日付の配列
  const dateList: { date: string; jstD: Date; dow: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getTime() + i * 86400_000);
    dateList.push({ date: isoDate(d), jstD: d, dow: jstDayOfWeek(d) });
  }

  // タブクリア
  await clearTab(spreadsheetId, tab);

  // 見出し行（A1〜A3 は説明、A5 から日付ヘッダ、A6+ がデータ）
  const HEADER_ROW = 5; // 1-based
  const DATA_START_ROW = HEADER_ROW + 1;

  const titleRows: (string | number)[][] = [
    [`📅 予約スケジュール`],
    [`最終更新: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`],
    [`凡例: ○n=残ベッド数, ×=満員, -=営業時間外/定休`],
    [""],
  ];
  await writeRange(spreadsheetId, `${tab}!A1:A${titleRows.length}`, titleRows);

  // ヘッダー行（日付）
  const dateHeader: (string | number)[] = ["時間"];
  for (const d of dateList) {
    const m = d.jstD.getUTCMonth() + 1 + 9 * 0; // JST は date 計算済み
    const day = new Date(d.jstD.getTime() + 9 * 60 * 60_000).getUTCDate();
    const mo = new Date(d.jstD.getTime() + 9 * 60 * 60_000).getUTCMonth() + 1;
    dateHeader.push(`${pad(mo)}/${pad(day)}(${DAYS_JP[d.dow]})`);
  }
  await writeRange(
    spreadsheetId,
    `${tab}!A${HEADER_ROW}:${columnLetter(dateHeader.length)}${HEADER_ROW}`,
    [dateHeader],
  );

  // データ行
  const dataRows: (string | number)[][] = [];
  for (const time of slotTimes) {
    const row: (string | number)[] = [time];
    const slotM = tToM(time);
    for (const d of dateList) {
      const h = hoursByDay.get(d.dow);
      const closed =
        !h ||
        h.isClosed ||
        !h.openTime ||
        !h.closeTime ||
        holidaySet.has(d.date) ||
        slotM < tToM(h.openTime) ||
        slotM + slotMinutes > tToM(h.closeTime);

      if (closed) {
        row.push("-");
        continue;
      }
      // この slot 帯 [start, start+slotMinutes) と重複する予約をカウント
      const slotStart = new Date(`${d.date}T${time}:00+09:00`);
      const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60_000);
      const overlap = reservations.filter(
        (r) => r.startAt < slotEnd && r.endAt > slotStart,
      ).length;
      const remaining = bedCount - overlap;
      if (remaining <= 0) row.push("×");
      else row.push(`○${remaining}`);
    }
    dataRows.push(row);
  }
  if (dataRows.length > 0) {
    await writeRange(
      spreadsheetId,
      `${tab}!A${DATA_START_ROW}:${columnLetter(dateHeader.length)}${DATA_START_ROW + dataRows.length - 1}`,
      dataRows,
    );
  }

  // 書式設定
  await applyScheduleFormatting(
    spreadsheetId,
    tab,
    DATA_START_ROW - 1, // 0-based のデータ開始（ヘッダー行直後）
    dataRows.length,
    dateList.length,
  );
}

function columnLetter(col: number): string {
  // 1-based 列番号 → 列文字（A, B, ..., Z, AA, AB, ...）
  let s = "";
  while (col > 0) {
    const r = (col - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
