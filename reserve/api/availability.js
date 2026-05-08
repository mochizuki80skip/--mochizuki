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

  if (!ALLOWED_CLINICS.has(clinic)) {
    return res.status(400).json({ error: 'invalid clinic' });
  }
  if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end)) {
    return res.status(400).json({ error: 'invalid date format, expect YYYYMMDD' });
  }

  const calendarUrl = `${UPSTREAM_BASE}/${clinic}/calendar?start_date=${start}&end_date=${end}`;

  try {
    const r = await fetch(calendarUrl, { headers: UPSTREAM_HEADERS });
    if (!r.ok) {
      return res.status(502).json({ error: 'upstream error', status: r.status });
    }
    const data = await r.json();
    const slots = (data && data.calendar && data.calendar.available_slots) || [];

    const available = [];
    for (const day of slots) {
      for (const t of (day.available_times || [])) {
        available.push({ date: day.date, iso: t });
      }
    }

    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=120');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({ clinic, start, end, available });
  } catch (err) {
    return res.status(502).json({
      error: 'fetch failed',
      message: (err && err.message) || String(err),
    });
  }
}
