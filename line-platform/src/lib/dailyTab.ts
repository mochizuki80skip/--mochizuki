// 当日タブ（予約表）を管理画面のデータから生成する。
// A列の時間・休憩行・施術者名・確定予約をすべて「営業時間＋枠幅＋休憩＋ベッド担当」から組み立てる。
// 見出し（1〜4行目）は既存タブのものを残し、5行目以降を作り直す。手入力は不要。
// 生成タイミング: 予約の確定/キャンセル時、ベッド担当・営業時間・休憩の保存時。
import { prisma } from "@/lib/prisma";
import {
  listTabs,
  ensureSheetTabs,
  writeRange,
  clearReservationBody,
  applyDailyTabFormatting,
} from "@/lib/sheets";

const NEW_ROW = 5; // 新規対応
const NAME_ROW = 6; // 施術者名
const FIRST_TIME_ROW = 7; // 時間枠の開始行（2行で1枠）
const DAYS_JP = ["日", "月", "火", "水", "木", "金", "土"];
const CLEAR_LAST_COL = 52; // AZ まで（古い行・列の残骸を消す）
const CLEAR_LAST_ROW = 300;
// 新規枠の2枠目に引く斜め線（黒）
const DIAG = '=SPARKLINE({1,0},{"charttype","line";"color","#000000";"linewidth",1})';

function bedColumn(bedNumber: number): number {
  return 2 + (bedNumber - 1) * 3; // bed1=B(2), bed2=E(5), bed3=H(8)...
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
// 日付文字列の曜日（0=日）。UTC 基準で計算してタイムゾーンずれを防ぐ
function dowOf(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00Z`).getUTCDay();
}

// 既存の "M/D" 始まりタブを探す。無ければ作成して名前を返す。
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
  const name = `${m}/${d}(${DAYS_JP[dowOf(dateIso)]})`;
  await ensureSheetTabs(spreadsheetId, [name]);
  return name;
}

// 日付の営業時間（日次設定 > 曜日既定）
async function resolveHours(
  channelId: string,
  dateIso: string,
  dow: number,
): Promise<{ openM: number; closeM: number } | null> {
  const daily = await prisma.dailyHours.findUnique({
    where: { lineChannelId_date: { lineChannelId: channelId, date: dateIso } },
  });
  if (daily?.openTime && daily.closeTime) {
    return { openM: tToM(daily.openTime), closeM: tToM(daily.closeTime) };
  }
  const wk = await prisma.businessHours.findUnique({
    where: { lineChannelId_dayOfWeek: { lineChannelId: channelId, dayOfWeek: dow } },
  });
  if (wk && !wk.isClosed && wk.openTime && wk.closeTime) {
    return { openM: tToM(wk.openTime), closeM: tToM(wk.closeTime) };
  }
  return null;
}

// 指定日の当日タブを生成（A列の時間・休憩・施術者名・予約）
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
  if (beds.length === 0) return; // 担当未登録の日はシートに触れない

  const dow = dowOf(dateIso);
  const hours = await resolveHours(channelId, dateIso, dow);
  if (!hours) return; // 営業時間が未設定なら触れない（誤消去防止）

  const slotMin = settings.slotMinutes || 15;
  const slotTimes: { m: number; t: string }[] = [];
  for (let m = hours.openM; m < hours.closeM; m += slotMin) slotTimes.push({ m, t: mToT(m) });
  if (slotTimes.length === 0) return;

  // 休憩帯
  const breaks = await prisma.dailyBreak.findMany({
    where: { lineChannelId: channelId, date: dateIso },
  });
  const breakWin = breaks.map((b) => ({ s: tToM(b.startTime), e: tToM(b.endTime) }));
  const isBreak = (m: number) => breakWin.some((br) => m >= br.s && m < br.e);

  const tab = await findOrCreateDayTab(spreadsheetId, dateIso);

  const maxBedCol = Math.max(...beds.map((b) => bedColumn(b.bedNumber)));
  const lastCol = maxBedCol + 2; // きっかけ列(+1) と チェック列(+2)
  const lastColL = columnLetter(lastCol);
  const lastRow = FIRST_TIME_ROW + slotTimes.length * 2 - 1; // 最終枠の電話行まで

  // 5行目以降の古い内容（値とデータ検証）を広めに消す。1〜4行目の見出しは残す
  await clearReservationBody(spreadsheetId, tab, NEW_ROW, CLEAR_LAST_ROW, 1, CLEAR_LAST_COL);

  // グリッド構築（5行目〜lastRow × A〜lastCol）
  const rowCount = lastRow - NEW_ROW + 1;
  const grid: string[][] = Array.from({ length: rowCount }, () => Array(lastCol).fill(""));
  const set = (row1: number, col1: number, val: string) => {
    const r = row1 - NEW_ROW;
    const c = col1 - 1;
    if (r >= 0 && r < rowCount && c >= 0 && c < lastCol) grid[r][c] = val;
  };

  // 見出しラベルとベッド担当（施術者名｜きっかけ｜チェック）
  set(NEW_ROW, 1, "新規対応");
  set(NAME_ROW, 1, "施術者");
  for (const b of beds) {
    const col = bedColumn(b.bedNumber);
    set(NEW_ROW, col, b.acceptsNew ? "TRUE" : "FALSE");
    set(NAME_ROW, col, b.therapistName);
    set(NAME_ROW, col + 1, "きっかけ");
    set(NAME_ROW, col + 2, "チェック");
  }

  // 時間ラベル / 休憩（A列は時間を表示。休憩は本文を「休憩」で塗りつぶし対象に）
  const rowOfMin = new Map<number, number>();
  slotTimes.forEach((s, i) => {
    const row = FIRST_TIME_ROW + i * 2;
    rowOfMin.set(s.m, row);
    set(row, 1, s.t);
    if (isBreak(s.m)) {
      for (let c = 2; c <= lastCol; c++) {
        set(row, c, "休憩");
        set(row + 1, c, "休憩");
      }
    }
  });

  // 確定予約
  const from = new Date(`${dateIso}T00:00:00+09:00`);
  const to = new Date(`${dateIso}T23:59:59+09:00`);
  const reservations = await prisma.reservation.findMany({
    where: { lineChannelId: channelId, status: "confirmed", startAt: { gte: from, lte: to } },
  });
  const bedNums = new Set(beds.map((b) => b.bedNumber));
  const span = Math.max(1, Math.ceil(30 / slotMin)); // 新規が占有する枠数

  for (const r of reservations) {
    if (r.bedNumber == null || !bedNums.has(r.bedNumber)) continue;
    const startM = tToM(jstHM(r.startAt));
    const row = rowOfMin.get(startM);
    if (row === undefined) continue;
    const col = bedColumn(r.bedNumber);
    set(row, col, r.customerName);
    set(row + 1, col, r.customerPhone);
    if (r.visitType === "new" && r.referralSource) set(row, col + 1, r.referralSource);
    if (r.visitType === "new") {
      for (let k = 1; k < span; k++) {
        set(row + k * 2, col, DIAG);
        set(row + k * 2 + 1, col, DIAG);
      }
    }
  }

  // 書き込み（A1の日付は別途）＋本文
  const [, mo, da] = dateIso.split("-");
  await writeRange(spreadsheetId, `${tab}!A1`, [[`${Number(mo)}/${Number(da)}(${DAYS_JP[dow]})`]]);
  await writeRange(spreadsheetId, `${tab}!A${NEW_ROW}:${lastColL}${lastRow}`, grid);
  await applyDailyTabFormatting(
    spreadsheetId,
    tab,
    NAME_ROW,
    FIRST_TIME_ROW,
    lastRow,
    lastCol,
    beds.map((b) => bedColumn(b.bedNumber)),
  );
}
