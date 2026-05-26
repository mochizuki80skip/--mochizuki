// 当日タブ（予約表）を管理画面のデータから完全生成する（閲覧用ミラー）。
// スプレッドシートには手入力しない前提。確定・キャンセル・ベッド担当の変更時に再生成する。
import { prisma } from "@/lib/prisma";
import {
  listTabs,
  ensureSheetTabs,
  clearTab,
  writeRange,
  applyDailyTabFormatting,
} from "@/lib/sheets";

const NAME_ROW = 6; // 施術者名の行（1-based）。confirm.ts の DAILY_NAME_ROW と一致
const NEW_ROW = 5; // 新規対応の行（1-based）
const FIRST_TIME_ROW = 7; // 時間枠の開始行（1-based）
const DAYS_JP = ["日", "月", "火", "水", "木", "金", "土"];
// 新規枠の2枠目に引く斜め線（黒）
const DIAG = '=SPARKLINE({1,0},{"charttype","line";"color","#000000";"linewidth",1})';

function bedColumn(bedNumber: number): number {
  return 2 + (bedNumber - 1) * 3; // 1-based: bed1=B(2), bed2=E(5)...
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
function tToM(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function mToT(m: number): string {
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
}
function jstHM(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 3600_000);
  return `${jst.getUTCHours()}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

// 既存の "M/D" タブ名を探す。無ければ作成する。
async function findOrCreateDayTab(spreadsheetId: string, dateIso: string): Promise<string> {
  const [, mo, da] = dateIso.split("-");
  const m = Number(mo);
  const d = Number(da);
  const tabs = await listTabs(spreadsheetId);
  const candidates = [
    `${m}/${d}`,
    `${m}/${String(d).padStart(2, "0")}`,
    `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`,
  ];
  for (const tab of tabs) {
    const head = tab.trim();
    const matched = candidates.find((c) => head.startsWith(c));
    if (matched) {
      const after = head.charAt(matched.length);
      if (after === "" || !/\d/.test(after)) return tab;
    }
  }
  const dow = new Date(`${dateIso}T00:00:00+09:00`).getUTCDay();
  const name = `${m}/${d}(${DAYS_JP[dow]})`;
  await ensureSheetTabs(spreadsheetId, [name]);
  return name;
}

// 指定日の当日タブを、ベッド担当＋営業時間＋確定予約から完全に再生成
export async function regenerateDailyTab(channelId: string, dateIso: string): Promise<void> {
  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
  });
  if (!settings?.spreadsheetId) return;
  const spreadsheetId = settings.spreadsheetId;

  const beds = await prisma.dailyBed.findMany({
    where: { lineChannelId: channelId, date: dateIso },
    orderBy: { bedNumber: "asc" },
  });

  const tab = await findOrCreateDayTab(spreadsheetId, dateIso);
  await clearTab(spreadsheetId, tab);

  const dow = new Date(`${dateIso}T00:00:00+09:00`).getUTCDay();
  const [, mo, da] = dateIso.split("-");
  const dateLabel = `${Number(mo)}/${Number(da)}(${DAYS_JP[dow]})`;

  // 営業時間
  const hours = await prisma.businessHours.findUnique({
    where: { lineChannelId_dayOfWeek: { lineChannelId: channelId, dayOfWeek: dow } },
  });

  // ベッドが無い、または営業時間未設定なら見出しのみ
  if (beds.length === 0 || !hours || hours.isClosed || !hours.openTime || !hours.closeTime) {
    await writeRange(spreadsheetId, `${tab}!A1`, [[dateLabel]]);
    await writeRange(spreadsheetId, `${tab}!A3`, [
      [beds.length === 0 ? "この日のベッド担当が未登録です（管理画面で設定）" : "この日は営業時間外/定休です"],
    ]);
    return;
  }

  const slotMin = settings.slotMinutes || 15;
  const openM = tToM(hours.openTime);
  const closeM = tToM(hours.closeTime);
  const slotTimes: string[] = [];
  for (let m = openM; m < closeM; m += slotMin) slotTimes.push(mToT(m));

  // 休憩時間
  const breaks = await prisma.dailyBreak.findMany({
    where: { lineChannelId: channelId, date: dateIso },
  });
  const breakWindows = breaks.map((b) => ({ s: tToM(b.startTime), e: tToM(b.endTime) }));
  const isBreakMin = (m: number) => breakWindows.some((br) => m < br.e && m + slotMin > br.s);

  const lastCol = bedColumn(beds[beds.length - 1].bedNumber) + 1;
  const lastColL = columnLetter(lastCol);
  const totalRows = FIRST_TIME_ROW + slotTimes.length * 2;

  // 空グリッドを構築（行 × 列）
  const grid: string[][] = Array.from({ length: totalRows }, () =>
    Array.from({ length: lastCol }, () => ""),
  );
  const set = (row1: number, col1: number, val: string) => {
    grid[row1 - 1][col1 - 1] = val;
  };

  // 見出し
  set(1, 1, dateLabel);
  set(NEW_ROW, 1, "新規対応");
  set(NAME_ROW, 1, "施術者");
  for (const b of beds) {
    const col = bedColumn(b.bedNumber);
    set(NEW_ROW, col, b.acceptsNew ? "可" : "");
    set(NAME_ROW, col, b.therapistName);
  }

  // 時間ラベル（2行で1枠、上の行にだけ時間）。休憩枠は "休憩" 表示
  const rowOfSlot = new Map<string, number>();
  slotTimes.forEach((t, i) => {
    const row = FIRST_TIME_ROW + i * 2;
    const m = tToM(t);
    if (isBreakMin(m)) {
      set(row, 1, "休憩");
      for (const b of beds) set(row, bedColumn(b.bedNumber), "休憩");
    } else {
      set(row, 1, t);
    }
    rowOfSlot.set(t, row);
  });

  // 確定予約
  const from = new Date(`${dateIso}T00:00:00+09:00`);
  const to = new Date(`${dateIso}T23:59:59+09:00`);
  const reservations = await prisma.reservation.findMany({
    where: {
      lineChannelId: channelId,
      status: "confirmed",
      startAt: { gte: from, lte: to },
    },
  });

  const bedNumbers = new Set(beds.map((b) => b.bedNumber));
  for (const r of reservations) {
    if (r.bedNumber == null || !bedNumbers.has(r.bedNumber)) continue;
    const t = jstHM(r.startAt);
    const row = rowOfSlot.get(t);
    if (row === undefined) continue;
    const col = bedColumn(r.bedNumber);
    const isNew = r.visitType === "new";
    set(row, col, r.customerName);
    set(row + 1, col, r.customerPhone);
    if (isNew && r.referralSource) set(row, col + 1, r.referralSource);
    // 新規(30分)は次の枠を斜め線でブロック表示
    if (isNew && slotMin < 30) {
      const span = Math.ceil(30 / slotMin); // 占有枠数
      for (let k = 1; k < span; k++) {
        const blockRow = row + k * 2;
        if (blockRow + 1 <= totalRows) {
          set(blockRow, col, DIAG);
          set(blockRow + 1, col, DIAG);
        }
      }
    }
  }

  await writeRange(spreadsheetId, `${tab}!A1:${lastColL}${totalRows}`, grid);
  await applyDailyTabFormatting(
    spreadsheetId,
    tab,
    NAME_ROW,
    FIRST_TIME_ROW,
    totalRows,
    beds.map((b) => bedColumn(b.bedNumber)),
  );
}
