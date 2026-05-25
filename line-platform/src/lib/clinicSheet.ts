// 接骨院の「当日シート」を解析して空き状況を計算する。
// シート構造:
//   1行目 A: 日付 "M/D"
//   5行目: 新規対応 (各施術者の名前列に TRUE/FALSE)
//   6行目: 施術者名 (各施術者の名前列に名前。空欄=非稼働)
//   7行目〜: 時間枠 (A列に "H:MM"、2行で1枠。休憩行は "休憩")
//   施術者 k (1始まり) の名前列 index(0始まり) = 1 + (k-1)*3
//   名前列にお客様名が入っていれば予約済み

import { listTabs, readRange } from "@/lib/sheets";

const NEW_ROW = 4; // 0-based: 5行目
const NAME_ROW = 5; // 0-based: 6行目
const MAX_THERAPISTS = 12;

export type Therapist = {
  index: number; // 1始まり
  name: string;
  acceptsNew: boolean;
  nameCol: number; // 0-based 列
};

export type TimeRow = {
  time: string; // "H:MM"
  minutes: number;
  cells: string[];
};

export type DaySchedule = {
  date: string;
  tabName: string;
  therapists: Therapist[]; // 稼働している施術者のみ
  timeRows: TimeRow[];
  granularityMin: number;
};

function tToM(t: string): number {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

// 対象日(YYYY-MM-DD)の "M/D" で始まるタブを探す
export async function findDayTab(spreadsheetId: string, dateIso: string): Promise<string | null> {
  const [, mo, da] = dateIso.split("-");
  const m = Number(mo);
  const d = Number(da);
  const tabs = await listTabs(spreadsheetId);
  // "M/D" または "MM/DD" 先頭一致（ゼロ埋め両対応）
  const candidates = [
    `${m}/${d}`,
    `${m}/${String(d).padStart(2, "0")}`,
    `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`,
  ];
  for (const tab of tabs) {
    const head = tab.trim();
    if (candidates.some((c) => head.startsWith(c))) {
      // "1/2" が "1/20" にヒットしないよう、直後が数字でないことを確認
      const matched = candidates.find((c) => head.startsWith(c));
      if (matched) {
        const after = head.charAt(matched.length);
        if (after === "" || !/\d/.test(after)) return tab;
      }
    }
  }
  return null;
}

// 当日シートを読み取り構造化
export async function readDaySchedule(
  spreadsheetId: string,
  tabName: string,
  dateIso: string,
): Promise<DaySchedule> {
  const values = await readRange(spreadsheetId, `${tabName}!A1:Z120`);

  const newRow = values[NEW_ROW] ?? [];
  const nameRow = values[NAME_ROW] ?? [];

  const therapists: Therapist[] = [];
  for (let k = 1; k <= MAX_THERAPISTS; k++) {
    const nameCol = 1 + (k - 1) * 3;
    const name = (nameRow[nameCol] ?? "").toString().trim();
    if (!name) continue; // 名前が無い=非稼働
    const acceptsNew = (newRow[nameCol] ?? "").toString().trim().toUpperCase() === "TRUE";
    therapists.push({ index: k, name, acceptsNew, nameCol });
  }

  // 時間行を抽出（A列が "H:MM"）
  const timeRows: TimeRow[] = [];
  for (let r = NAME_ROW + 1; r < values.length; r++) {
    const row = values[r] ?? [];
    const label = (row[0] ?? "").toString().trim();
    const mins = tToM(label);
    if (mins < 0) continue; // 休憩・空行はスキップ
    timeRows.push({ time: label, minutes: mins, cells: row });
  }

  // 粒度（連続する時間行の差の最小値）
  let granularity = 15;
  if (timeRows.length >= 2) {
    let minDiff = Infinity;
    for (let i = 1; i < timeRows.length; i++) {
      const diff = timeRows[i].minutes - timeRows[i - 1].minutes;
      if (diff > 0) minDiff = Math.min(minDiff, diff);
    }
    if (minDiff !== Infinity) granularity = minDiff;
  }

  return { date: dateIso, tabName, therapists, timeRows, granularityMin: granularity };
}

function isBooked(cell: string | undefined): boolean {
  return !!(cell ?? "").toString().trim();
}

export type SheetSlot = {
  time: string;
  available: boolean;
  remaining: number;
};

export type SheetDayAvailability = {
  date: string;
  hasSheet: boolean;
  slots: SheetSlot[];
};

// 区分別の空き状況を計算
export function computeSlots(
  schedule: DaySchedule,
  visitType: "new" | "returning",
  newDurationMin: number,
  returningDurationMin: number,
): SheetSlot[] {
  const { therapists, timeRows, granularityMin: granularity } = schedule;
  const duration = visitType === "new" ? newDurationMin : returningDurationMin;
  const needed = Math.max(1, Math.ceil(duration / granularity));

  // 時間 → index の早見表
  const idxByMinutes = new Map<number, number>();
  timeRows.forEach((tr, i) => idxByMinutes.set(tr.minutes, i));

  const slots: SheetSlot[] = [];
  for (let i = 0; i < timeRows.length; i++) {
    const tr = timeRows[i];

    // 新規は :00 / :30（30分の倍数）のみ開始可能
    if (visitType === "new" && tr.minutes % 30 !== 0) {
      continue;
    }

    // 連続 needed 枠が時間的に連続しているか（休憩跨ぎ・末尾を除外）
    const consecutiveRows: TimeRow[] = [tr];
    let ok = true;
    for (let k = 1; k < needed; k++) {
      const nextMin = tr.minutes + k * granularity;
      const ni = idxByMinutes.get(nextMin);
      if (ni === undefined) { ok = false; break; }
      consecutiveRows.push(timeRows[ni]);
    }
    if (!ok) continue;

    // 各施術者について、必要な全枠が空いているか
    let remaining = 0;
    for (const th of therapists) {
      if (visitType === "new" && !th.acceptsNew) continue;
      const allFree = consecutiveRows.every((cr) => !isBooked(cr.cells[th.nameCol]));
      if (allFree) remaining++;
    }
    slots.push({ time: tr.time, available: remaining > 0, remaining });
  }
  return slots;
}
