// 当日タブ（予約表）を「埋める」方式で更新する。
// スタッフが使い慣れたタブの書式・枠線・列Aの時間はそのまま残し、
// 施術者名(行6)・新規対応(行5)・確定予約・休憩だけを管理画面の内容で書き換える。
import { prisma } from "@/lib/prisma";
import { listTabs, readRange, writeRange, clearReservationBody } from "@/lib/sheets";

const NAME_ROW = 6; // 施術者名の行（1-based）
const NEW_ROW = 5; // 新規対応の行（1-based）
const FIRST_TIME_ROW = 7; // 時間枠の開始行（1-based）。列Aの時間を実際に読んで行位置を決める
// 新規枠の2枠目に引く斜め線（黒）
const DIAG = '=SPARKLINE({1,0},{"charttype","line";"color","#000000";"linewidth",1})';

function bedColumn(bedNumber: number): number {
  return 2 + (bedNumber - 1) * 3; // 1-based: bed1=B(2), bed2=E(5), bed3=H(8)...
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
function normTime(s: string): string {
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2})/);
  return m ? `${parseInt(m[1], 10)}:${m[2]}` : "";
}
function jstHM(d: Date): string {
  const jst = new Date(d.getTime() + 9 * 3600_000);
  return `${jst.getUTCHours()}:${String(jst.getUTCMinutes()).padStart(2, "0")}`;
}

// 既存の "M/D" 始まりタブを探す（無ければ null）
async function findDayTab(spreadsheetId: string, dateIso: string): Promise<string | null> {
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
  return null;
}

// 指定日の当日タブを、ベッド担当＋確定予約＋休憩で「埋める」（書式は維持）
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
  if (beds.length === 0) return; // 担当未登録の日はシートに触れない（誤消去防止）

  const tab = await findDayTab(spreadsheetId, dateIso);
  if (!tab) return; // 当日タブが無ければ何もしない（テンプレートを上書きしない）

  // 列A から「時間 → 行番号(1-based)」を読み取る（テンプレートの実際の行位置に合わせる）
  const colA = await readRange(spreadsheetId, `${tab}!A1:A400`);
  const rowOfTime = new Map<string, number>();
  let lastTimeRow = FIRST_TIME_ROW;
  for (let i = FIRST_TIME_ROW - 1; i < colA.length; i++) {
    const t = normTime(colA[i]?.[0] ?? "");
    if (t) {
      rowOfTime.set(t, i + 1);
      lastTimeRow = i + 1;
    }
  }

  const maxBedCol = Math.max(...beds.map((b) => bedColumn(b.bedNumber)));
  const lastCol = maxBedCol + 1; // きっかけ列ぶん +1
  const lastColL = columnLetter(lastCol);
  const bodyLastRow = lastTimeRow + 1; // 電話は時間行の1つ下
  const width = lastCol - 1; // 列B(2) から

  // 本文（予約記入域）の値とデータ検証だけを消す（列Aの時間・枠線・見出しは残す）
  await clearReservationBody(spreadsheetId, tab, FIRST_TIME_ROW, bodyLastRow, 2, lastCol);

  // 施術者名(行6)・新規対応(行5) を書き換え
  const row5: string[] = Array(width).fill("");
  const row6: string[] = Array(width).fill("");
  for (const b of beds) {
    const idx = bedColumn(b.bedNumber) - 2;
    row5[idx] = b.acceptsNew ? "TRUE" : "FALSE";
    row6[idx] = b.therapistName;
  }
  await writeRange(spreadsheetId, `${tab}!B${NEW_ROW}:${lastColL}${NEW_ROW}`, [row5]);
  await writeRange(spreadsheetId, `${tab}!B${NAME_ROW}:${lastColL}${NAME_ROW}`, [row6]);

  // 休憩帯
  const breaks = await prisma.dailyBreak.findMany({
    where: { lineChannelId: channelId, date: dateIso },
  });
  const breakWin = breaks.map((b) => ({ s: tToM(b.startTime), e: tToM(b.endTime) }));

  // 確定予約
  const from = new Date(`${dateIso}T00:00:00+09:00`);
  const to = new Date(`${dateIso}T23:59:59+09:00`);
  const reservations = await prisma.reservation.findMany({
    where: { lineChannelId: channelId, status: "confirmed", startAt: { gte: from, lte: to } },
  });
  const bedNums = new Set(beds.map((b) => b.bedNumber));

  // 本文グリッド（行 FIRST_TIME_ROW..bodyLastRow × 列 B..lastCol）
  const bodyRows = bodyLastRow - FIRST_TIME_ROW + 1;
  const grid: string[][] = Array.from({ length: bodyRows }, () => Array(width).fill(""));
  const setBody = (row1: number, col1: number, val: string) => {
    const r = row1 - FIRST_TIME_ROW;
    const c = col1 - 2;
    if (r >= 0 && r < bodyRows && c >= 0 && c < width) grid[r][c] = val;
  };

  // 休憩マーク
  for (const [t, row] of rowOfTime) {
    const m = tToM(t);
    if (breakWin.some((br) => m >= br.s && m < br.e)) {
      for (const b of beds) setBody(row, bedColumn(b.bedNumber), "休憩");
    }
  }

  // 予約記入
  for (const r of reservations) {
    if (r.bedNumber == null || !bedNums.has(r.bedNumber)) continue;
    const row = rowOfTime.get(normTime(jstHM(r.startAt)));
    if (row === undefined) continue;
    const col = bedColumn(r.bedNumber);
    setBody(row, col, r.customerName);
    setBody(row + 1, col, r.customerPhone);
    if (r.visitType === "new" && r.referralSource) setBody(row, col + 1, r.referralSource);
    // 新規(30分)は次の時間枠（2行下）を斜め線でブロック
    if (r.visitType === "new") {
      setBody(row + 2, col, DIAG);
      setBody(row + 3, col, DIAG);
    }
  }

  await writeRange(spreadsheetId, `${tab}!B${FIRST_TIME_ROW}:${lastColL}${bodyLastRow}`, grid);
}
