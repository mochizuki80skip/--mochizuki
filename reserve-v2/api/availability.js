// 公開: 空き状況
//   GET /api/availability?clinic=192&start=20260919&end=20260925&course_id=c-xxxx
//
// 現行システムと違い threease には問い合わせず、管理画面で設定した
// 営業時間と埋まり枠から計算して返す。start〜end はまとめて指定できるので、
// 1週間ぶんを 1 リクエストで取得できる。

import {
  getSchedule,
  getBookedMap,
  listCourses,
  isStorageUnconfiguredError,
  CLINIC_IDS,
} from './_store.js';
import { toDashedYmd, enumerateDates, buildAvailability } from './_slots.js';

export default async function handler(req, res) {
  const clinic = String(req.query.clinic || '');
  const start = toDashedYmd(req.query.start);
  const end = toDashedYmd(req.query.end) || start;
  const courseId = String(req.query.course_id || '').trim();

  if (!CLINIC_IDS.includes(clinic)) {
    return res.status(400).json({ error: 'invalid clinic' });
  }
  if (!start || !end) {
    return res.status(400).json({ error: 'invalid date format, expect YYYYMMDD' });
  }

  try {
    const [schedule, courses] = await Promise.all([getSchedule(), listCourses()]);

    // コース指定があれば、その所要時間ぶんの連続枠が必要
    let duration = null;
    if (courseId) {
      const course = courses.find((c) => c.id === courseId);
      if (course) duration = course.duration;
    }
    // course_id が無くても duration 指定は受け付ける（従来互換）
    const durationRaw = Number(req.query.duration);
    if (!duration && Number.isFinite(durationRaw) && durationRaw > 0) {
      duration = Math.floor(durationRaw);
    }

    const ymds = enumerateDates(start, end);
    const bookedMap = await getBookedMap(clinic, ymds);
    const { available, axisAvailable, slotMin, capacity } =
      buildAvailability({ schedule, clinic, ymds, bookedMap, duration });

    // 自前のデータなので短めのキャッシュで十分。管理画面で枠を閉じたら
    // すぐ反映されてほしいので長くしない。
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=20, stale-while-revalidate=60');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      clinic,
      start,
      end,
      courseId: courseId || null,
      duration,
      slotMin,
      capacity,
      available,
      unknown: [], // v2 では取得失敗の「?」状態は発生しない
      axisAvailable,
    });
  } catch (err) {
    if (isStorageUnconfiguredError(err)) {
      return res.status(503).json({
        error: 'storage_unconfigured',
        message: 'Upstash Redis が未接続です。Vercel の Storage から接続してください。',
      });
    }
    return res.status(500).json({
      error: 'availability failed',
      message: (err && err.message) || String(err),
    });
  }
}
