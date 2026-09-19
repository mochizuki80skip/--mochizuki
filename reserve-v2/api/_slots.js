// 予約枠の生成ロジック（すべて JST 基準）
//
// 現行システムは threease に「この時間は予約できるか」を1枠ずつ問い合わせて
// いたが、v2 は自分たちの営業時間設定から枠を組み立て、埋まり枠を差し引く。
// 外部への問い合わせが無いので速く、失敗もしない。

import { hhmmToMin, minToHhmm, rangesForDate } from './_store.js';

const JST_OFFSET = '+09:00';

// 'YYYYMMDD' / 'YYYY-MM-DD' のどちらでも 'YYYY-MM-DD' に揃える
export function toDashedYmd(s) {
  const t = String(s || '').trim();
  if (/^\d{8}$/.test(t)) return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}

// JST の曜日（0=日 … 6=土）。UTC 換算のズレを避けるため数値から直接求める。
export function dowOfYmd(ymd) {
  const [y, m, d] = ymd.split('-').map((s) => parseInt(s, 10));
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isoOf(ymd, hhmm) {
  return `${ymd}T${hhmm}:00${JST_OFFSET}`;
}

// start から end まで（両端含む）の日付一覧。上限を超える指定は切り詰める。
export function enumerateDates(startYmd, endYmd, maxDays = 31) {
  const out = [];
  const [sy, sm, sd] = startYmd.split('-').map((s) => parseInt(s, 10));
  const [ey, em, ed] = endYmd.split('-').map((s) => parseInt(s, 10));
  let cur = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  while (cur <= end && out.length < maxDays) {
    const d = new Date(cur);
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    out.push(ymd);
    cur += 86400000;
  }
  return out;
}

// 営業時間帯を slotMin 刻みに割った開始時刻の一覧。
// 終了時刻ちょうどは枠にしない（19:00 終了なら 18:30 が最後の枠）。
export function slotsInRanges(ranges, slotMin) {
  const out = [];
  for (const r of ranges) {
    const s = hhmmToMin(r.start);
    const e = hhmmToMin(r.end);
    for (let t = s; t < e; t += slotMin) out.push(minToHhmm(t));
  }
  return out;
}

// duration 分の施術が、休憩をまたがず1つの営業帯に収まるか
export function fitsInOneRange(ranges, startMin, durationMin) {
  for (const r of ranges) {
    const s = hhmmToMin(r.start);
    const e = hhmmToMin(r.end);
    if (startMin >= s && startMin + durationMin <= e) return true;
  }
  return false;
}

// 指定期間の空き枠を組み立てる。
//   schedule   … normalizeSchedule 済みの設定
//   bookedMap  … { 'YYYY-MM-DD': { 'HH:MM': 件数 } }
//   duration   … 選択中コースの所要時間（分）。未指定なら slotMin 扱い。
// 戻り値は現行システムの /api/availability と同じ形にしてあるので、
// フロント側の描画コードをそのまま使える。
export function buildAvailability({ schedule, clinic, ymds, bookedMap, duration }) {
  const slotMin = schedule.slotMin;
  const capacity = (schedule.clinics[clinic] && schedule.clinics[clinic].capacity) || 1;
  const needMin = (Number.isFinite(duration) && duration > 0) ? duration : slotMin;
  const nowMs = Date.now();

  const available = [];
  const axisAvailable = [];

  for (const ymd of ymds) {
    const ranges = rangesForDate(schedule, clinic, ymd, dowOfYmd(ymd));
    if (!ranges.length) continue;

    const booked = bookedMap[ymd] || {};
    const times = slotsInRanges(ranges, slotMin);

    for (const hhmm of times) {
      const iso = isoOf(ymd, hhmm);
      // 時間軸は「営業している枠すべて」。埋まっていても列がずれないようにする。
      axisAvailable.push({ date: ymd, iso });

      // 開始時刻を過ぎた枠は出さない
      if (new Date(iso).getTime() <= nowMs) continue;

      const startMin = hhmmToMin(hhmm);
      if (!fitsInOneRange(ranges, startMin, needMin)) continue;

      // 所要時間ぶんの連続枠がすべて空いているか
      const needSlots = Math.ceil(needMin / slotMin);
      let ok = true;
      for (let k = 0; k < needSlots; k++) {
        const t = minToHhmm(startMin + k * slotMin);
        if ((Number(booked[t]) || 0) >= capacity) { ok = false; break; }
      }
      if (ok) available.push({ date: ymd, iso });
    }
  }

  return { available, axisAvailable, slotMin, capacity };
}
