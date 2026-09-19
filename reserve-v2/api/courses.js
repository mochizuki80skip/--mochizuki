// 公開: メニュー（コース）一覧
//   GET /api/courses?clinic=192&visit=first
//
// 管理画面で登録したメニューマスタから、その院・その来院パターンで
// 出すものだけを返す。threease からは取得しない。

import { listCourses, isStorageUnconfiguredError, CLINIC_IDS, VISIT_MODES } from './_store.js';

export default async function handler(req, res) {
  const clinic = String(req.query.clinic || '');
  const visitRaw = String(req.query.visit || '').trim();
  const visit = VISIT_MODES.includes(visitRaw) ? visitRaw : null;

  if (!CLINIC_IDS.includes(clinic)) {
    return res.status(400).json({ error: 'invalid clinic' });
  }

  try {
    const all = await listCourses();
    const courses = all
      .filter((c) => c.active)
      .filter((c) => c.clinic === 'both' || c.clinic === clinic)
      .filter((c) => !visit || c.visitModes.includes(visit))
      .sort((a, b) => a.order - b.order)
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        duration: c.duration,
        price: c.price,
      }));

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=120');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ clinic, visit, courses });
  } catch (err) {
    if (isStorageUnconfiguredError(err)) {
      return res.status(503).json({ error: 'storage_unconfigured', courses: [] });
    }
    return res.status(500).json({ error: 'courses failed', courses: [] });
  }
}
