// 管理: 予約枠の埋まり状況
//   GET  /api/admin/bookings?clinic=192&start=20260919&end=20260925
//        … その週のグリッド（営業枠と埋まり件数）を返す。管理画面の週表示用。
//   POST /api/admin/bookings
//        { clinic, ymd, time, count }   … 1枠の件数を直接指定（0 で空きに戻す）
//        { clinic, ymd, time, delta }   … 1枠を増減（+1 / -1）
//        { clinic, ymd, times: {...} }  … その日を丸ごと置き換え

import {
  checkAuth,
  readJsonBody,
  getSchedule,
  getBookedMap,
  setBookedForDate,
  isStorageUnconfiguredError,
  CLINIC_IDS,
} from '../_store.js';
import { toDashedYmd, enumerateDates, dowOfYmd, isoOf, slotsInRanges } from '../_slots.js';
import { rangesForDate } from '../_store.js';

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const clinic = String(req.query.clinic || '');
      const start = toDashedYmd(req.query.start);
      const end = toDashedYmd(req.query.end) || start;
      if (!CLINIC_IDS.includes(clinic)) return res.status(400).json({ error: 'invalid clinic' });
      if (!start) return res.status(400).json({ error: 'invalid date' });

      const schedule = await getSchedule();
      const capacity = schedule.clinics[clinic].capacity;
      const ymds = enumerateDates(start, end);
      const bookedMap = await getBookedMap(clinic, ymds);

      const days = ymds.map((ymd) => {
        const dow = dowOfYmd(ymd);
        const ranges = rangesForDate(schedule, clinic, ymd, dow);
        const booked = bookedMap[ymd] || {};
        const ex = schedule.clinics[clinic].exceptions[ymd];
        return {
          ymd,
          dow,
          closed: ranges.length === 0,
          isException: !!ex,
          ranges,
          slots: slotsInRanges(ranges, schedule.slotMin).map((time) => {
            const n = Number(booked[time]) || 0;
            return { time, iso: isoOf(ymd, time), booked: n, full: n >= capacity };
          }),
        };
      });

      return res.status(200).json({ clinic, start, end, slotMin: schedule.slotMin, capacity, days });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const clinic = String(body.clinic || '');
      const ymd = toDashedYmd(body.ymd);
      if (!CLINIC_IDS.includes(clinic)) return res.status(400).json({ error: 'invalid clinic' });
      if (!ymd) return res.status(400).json({ error: 'invalid date' });

      const schedule = await getSchedule();
      const capacity = schedule.clinics[clinic].capacity;

      // その日を丸ごと置き換え
      if (body.times && typeof body.times === 'object') {
        const saved = await setBookedForDate(clinic, ymd, body.times);
        return res.status(200).json({ clinic, ymd, times: saved });
      }

      const time = String(body.time || '');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        return res.status(400).json({ error: 'invalid time' });
      }

      const current = (await getBookedMap(clinic, [ymd]))[ymd] || {};
      let next = Number(current[time]) || 0;

      if (body.count !== undefined) {
        next = Math.floor(Number(body.count));
      } else if (body.delta !== undefined) {
        next += Math.floor(Number(body.delta));
      } else {
        // 指定が無ければトグル（空き ⇄ 満）
        next = next >= capacity ? 0 : capacity;
      }
      if (!Number.isFinite(next)) next = 0;
      next = Math.max(0, Math.min(capacity, next));

      const updated = { ...current };
      if (next > 0) updated[time] = next; else delete updated[time];

      const saved = await setBookedForDate(clinic, ymd, updated);
      return res.status(200).json({
        clinic, ymd, time,
        booked: next,
        full: next >= capacity,
        times: saved,
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    if (isStorageUnconfiguredError(err)) {
      return res.status(503).json({
        error: 'storage_unconfigured',
        message: 'Upstash Redis が未接続です。Vercel の Storage から接続してください。',
      });
    }
    return res.status(500).json({ error: 'bookings error', message: (err && err.message) || String(err) });
  }
}
