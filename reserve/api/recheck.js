// Re-query a single (clinic, course, start_time) combo for the calendar UI's
// "?" slots. Skips the KV cache so it's always fresh.

import { recordUpstreamCall } from './_cache-stats.js';

const UPSTREAM_BASE = 'https://api.threease.com/api/v1/home/providers';

const UPSTREAM_HEADERS = {
  'Accept': 'application/json',
  'Origin': 'https://reservation.threease.com',
  'Referer': 'https://reservation.threease.com/',
  'User-Agent': 'Mozilla/5.0 (compatible; recovery-clinic-mirror/1.0)',
  'Accept-Language': 'ja',
};

const ALLOWED_CLINICS = new Set(['192', '193']);

export default async function handler(req, res) {
  const clinic = String(req.query.clinic || '');
  const courseId = String(req.query.course_id || '').trim();
  const iso = String(req.query.iso || '');
  const forNew = String(req.query.for_new || '').toLowerCase();
  const forNewBool = forNew === 'true' ? true : forNew === 'false' ? false : null;

  if (!ALLOWED_CLINICS.has(clinic)) return res.status(400).json({ error: 'invalid clinic' });
  if (!/^\d+$/.test(courseId)) return res.status(400).json({ error: 'invalid course_id' });
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(iso)) return res.status(400).json({ error: 'invalid iso' });

  const params = new URLSearchParams({ per: '100', page: '1', home: 'false', start_time: iso });
  if (forNewBool !== null) params.set('for_new_customers', String(forNewBool));
  const url = `${UPSTREAM_BASE}/${clinic}/courses?${params.toString()}`;

  const courseIdNum = parseInt(courseId, 10);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const startTs = Date.now();
  try {
    const r = await fetch(url, { headers: UPSTREAM_HEADERS, signal: ctrl.signal });
    clearTimeout(timer);
    const dur = Date.now() - startTs;
    if (!r.ok) {
      recordUpstreamCall('courses', 'fail', dur);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ status: 'failed' });
    }
    const data = await r.json();
    const ids = data && Array.isArray(data.courses)
      ? data.courses.map((c) => c.id).filter((x) => x != null)
      : [];
    recordUpstreamCall('courses', 'ok', dur);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      status: 'ok',
      bookable: ids.includes(courseIdNum),
    });
  } catch {
    clearTimeout(timer);
    const dur = Date.now() - startTs;
    recordUpstreamCall('courses', 'fail', dur);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ status: 'failed' });
  }
}
