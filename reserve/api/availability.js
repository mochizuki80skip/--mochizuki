const ALLOWED_CLINICS = new Set(['192', '193']);
const UPSTREAM_BASE = 'https://api.threease.com/api/v1/home/providers';

const UPSTREAM_HEADERS = {
  'Accept': 'application/json',
  'Origin': 'https://reservation.threease.com',
  'Referer': 'https://reservation.threease.com/',
  'User-Agent': 'Mozilla/5.0 (compatible; recovery-clinic-mirror/1.0)',
  'Accept-Language': 'ja',
};

async function fetchJson(url) {
  const r = await fetch(url, { headers: UPSTREAM_HEADERS });
  if (!r.ok) {
    throw Object.assign(new Error(`upstream ${r.status}`), { status: r.status });
  }
  return r.json();
}

async function fetchInBatches(items, batchSize, fn) {
  const out = new Array(items.length);
  for (let i = 0; i < items.length; i += batchSize) {
    const slice = items.slice(i, i + batchSize);
    const results = await Promise.all(slice.map((it, idx) => fn(it, i + idx)));
    for (let j = 0; j < results.length; j++) out[i + j] = results[j];
  }
  return out;
}

export default async function handler(req, res) {
  const clinic = String(req.query.clinic || '');
  const start = String(req.query.start || '');
  const end = String(req.query.end || '');
  const forNew = String(req.query.for_new || 'false') === 'true';

  if (!ALLOWED_CLINICS.has(clinic)) {
    return res.status(400).json({ error: 'invalid clinic' });
  }
  if (!/^\d{8}$/.test(start) || !/^\d{8}$/.test(end)) {
    return res.status(400).json({ error: 'invalid date format, expect YYYYMMDD' });
  }

  const provider = `${UPSTREAM_BASE}/${clinic}`;

  try {
    // 1. Calendar: which times have any availability this week?
    const calendarUrl = `${provider}/calendar?start_date=${start}&end_date=${end}`;
    // 2. Course list (general, filtered by for_new_customers only)
    const coursesUrl = `${provider}/courses?per=100&page=1&home=false&for_new_customers=${forNew}`;

    const [calendar, coursesData] = await Promise.all([
      fetchJson(calendarUrl),
      fetchJson(coursesUrl),
    ]);

    const slots = (calendar && calendar.calendar && calendar.calendar.available_slots) || [];
    const courses = (coursesData && coursesData.courses) || [];

    // 3. Collect all unique candidate times across the week
    const timeSet = new Set();
    for (const day of slots) {
      for (const t of (day.available_times || [])) timeSet.add(t);
    }
    const times = [...timeSet];

    // 4. For each candidate time, fetch which courses are bookable.
    //    Done in batches to avoid overwhelming upstream.
    const timeResults = await fetchInBatches(times, 8, async (t) => {
      const url = `${provider}/courses?per=100&page=1&home=false&start_time=${encodeURIComponent(t)}&for_new_customers=${forNew}`;
      try {
        const d = await fetchJson(url);
        const ids = ((d && d.courses) || []).map((c) => c.id);
        return { iso: t, course_ids: ids };
      } catch {
        return { iso: t, course_ids: [] };
      }
    });

    const timeToCourses = {};
    for (const r of timeResults) timeToCourses[r.iso] = r.course_ids;

    const available = [];
    for (const day of slots) {
      for (const t of (day.available_times || [])) {
        available.push({
          date: day.date,
          iso: t,
          course_ids: timeToCourses[t] || [],
        });
      }
    }

    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=120');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json({
      clinic,
      start,
      end,
      for_new: forNew,
      courses: courses.map((c) => ({
        id: c.id,
        name: c.product_name || c.name,
        description: c.description || '',
        duration: c.duration,
        price: c.price,
      })),
      available,
    });
  } catch (err) {
    return res.status(502).json({
      error: 'fetch failed',
      message: (err && err.message) || String(err),
    });
  }
}
