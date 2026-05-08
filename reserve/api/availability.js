const ALLOWED_CLINICS = new Set(['192', '193']);
const UPSTREAM_BASE = 'https://api.threease.com/api/v1/home/providers';

const UPSTREAM_HEADERS = {
  'Accept': 'application/json',
  'Origin': 'https://reservation.threease.com',
  'Referer': 'https://reservation.threease.com/',
  'User-Agent': 'Mozilla/5.0 (compatible; recovery-clinic-mirror/1.0)',
  'Accept-Language': 'ja',
};

export default async function handler(req, res) {
  const clinic = String(req.query.clinic || '');
  const start = String(req.query.start || '');
  const end = String(req.query.end || '');
  const courseId = String(req.query.course_id || '').trim();

  if (!ALLOWED_CLINICS.has(clinic)) {
    return res.status(400).json({ error: 'invalid clinic' });
  }
  if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end)) {
    return res.status(400).json({ error: 'invalid date format, expect YYYYMMDD' });
  }
  // course_id, when supplied, must be a positive integer
  if (courseId && !/^\d+$/.test(courseId)) {
    return res.status(400).json({ error: 'invalid course_id' });
  }
  const forNew = String(req.query.for_new || '').toLowerCase();
  const forNewBool = forNew === 'true' ? true : forNew === 'false' ? false : null;

  const params = new URLSearchParams({ start_date: start, end_date: end });
  if (courseId) params.set('course_id', courseId);
  if (forNewBool !== null) params.set('for_new_customers', String(forNewBool));
  // Try the course-scoped endpoint first when a course is specified.
  // Falls back to the provider-level calendar if the upstream returns 404.
  const tryUrls = [];
  if (courseId) {
    tryUrls.push(`${UPSTREAM_BASE}/${clinic}/courses/${courseId}/calendar?${params.toString()}`);
  }
  tryUrls.push(`${UPSTREAM_BASE}/${clinic}/calendar?${params.toString()}`);

  const debug = req.query.debug === '1';

  try {
    let r = null;
    let usedUrl = null;
    let rawText = null;
    for (const u of tryUrls) {
      r = await fetch(u, { headers: UPSTREAM_HEADERS });
      usedUrl = u;
      if (r.ok) break;
      if (r.status !== 404 && r.status !== 405) break;
    }
    if (!r || !r.ok) {
      const body = r ? await r.text().catch(() => '') : '';
      return res.status(502).json({
        error: 'upstream error',
        status: r ? r.status : 0,
        url: usedUrl,
        body: body.slice(0, 1000),
      });
    }
    rawText = await r.text();
    let data;
    try { data = JSON.parse(rawText); } catch { data = null; }
    const slots = (data && data.calendar && data.calendar.available_slots) || [];

    const available = [];
    for (const day of slots) {
      for (const t of (day.available_times || [])) {
        available.push({ date: day.date, iso: t });
      }
    }

    const payload = {
      clinic,
      start,
      end,
      courseId: courseId || null,
      forNew: forNewBool,
      available,
      _via: usedUrl ? new URL(usedUrl).pathname + (new URL(usedUrl).search || '') : null,
    };
    if (debug) {
      payload._raw = rawText;
      payload._upstreamUrls = tryUrls;
    }

    res.setHeader('Cache-Control', debug ? 'no-store' : 's-maxage=120, stale-while-revalidate=120');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(502).json({
      error: 'fetch failed',
      message: (err && err.message) || String(err),
    });
  }
}
