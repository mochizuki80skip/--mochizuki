const ALLOWED_CLINICS = new Set(['192', '193']);
const UPSTREAM_BASE = 'https://api.threease.com/api/v1/home/providers';

const UPSTREAM_HEADERS = {
  'Accept': 'application/json',
  'Origin': 'https://reservation.threease.com',
  'Referer': 'https://reservation.threease.com/',
  'User-Agent': 'Mozilla/5.0 (compatible; recovery-clinic-mirror/1.0)',
  'Accept-Language': 'ja',
};

// At a given clinic + start time, threease returns the course IDs that are
// actually bookable then (taking real bookings into account). This is the
// filter the reservation UI uses; the calendar endpoint alone only checks
// room-level availability and over-reports.
async function fetchBookableCourseIdsAt(clinic, startIso, forNewBool) {
  const params = new URLSearchParams({
    per: '100',
    page: '1',
    home: 'false',
    start_time: startIso,
  });
  if (forNewBool !== null) params.set('for_new_customers', String(forNewBool));
  const url = `${UPSTREAM_BASE}/${clinic}/courses?${params.toString()}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, { headers: UPSTREAM_HEADERS, signal: ctrl.signal });
    if (!r.ok) return null;
    const data = await r.json();
    if (data && Array.isArray(data.courses)) {
      return data.courses.map((c) => c.id).filter((x) => x != null);
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function filterByBookableCourse(clinic, courseIdNum, slots, forNewBool, concurrency = 12) {
  const results = new Array(slots.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= slots.length) return;
      results[i] = await fetchBookableCourseIdsAt(clinic, slots[i].iso, forNewBool);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, slots.length) }, worker));
  const debug = {};
  for (let i = 0; i < slots.length; i++) debug[slots[i].iso] = results[i];
  const kept = slots.filter((_, i) => {
    const ids = results[i];
    if (ids == null) return true; // fail open on error
    return ids.includes(courseIdNum);
  });
  return { kept, debug };
}

async function fetchTherapistIds(clinic, courseId, startIso) {
  const url = `${UPSTREAM_BASE}/${clinic}/therapists?per=100&page=1&home=false`
    + `&course_id=${encodeURIComponent(courseId)}`
    + `&start_time=${encodeURIComponent(startIso)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, { headers: UPSTREAM_HEADERS, signal: ctrl.signal });
    if (!r.ok) return null;
    const data = await r.json();
    if (data && Array.isArray(data.therapists)) {
      return data.therapists.map((t) => t.id).filter((x) => x != null);
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const SLOT_INCREMENT_MIN = 30;

function addMinutesToIso(iso, minutes) {
  if (!minutes) return iso;
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(.*)$/);
  if (!m) return iso;
  const [, date, hh, mm, ss, tz] = m;
  const total = parseInt(hh, 10) * 60 + parseInt(mm, 10) + minutes;
  if (total < 0 || total >= 24 * 60) return iso;
  const newH = String(Math.floor(total / 60)).padStart(2, '0');
  const newM = String(total % 60).padStart(2, '0');
  return `${date}T${newH}:${newM}:${ss}${tz}`;
}

// Filter slots: a slot is bookable only when there is at least one therapist
// who is free for *all* 30-min sub-slots that the course requires.
// Returns { kept, debug } where debug maps each iso -> therapist id list.
async function filterByConsecutiveTherapists(clinic, courseId, slots, durationMin, concurrency = 12) {
  const needed = Math.max(1, Math.ceil((durationMin || SLOT_INCREMENT_MIN) / SLOT_INCREMENT_MIN));
  const isoSet = new Set();
  for (const s of slots) {
    for (let k = 0; k < needed; k++) {
      isoSet.add(addMinutesToIso(s.iso, k * SLOT_INCREMENT_MIN));
    }
  }
  const isos = Array.from(isoSet);
  const idsByIso = new Map();

  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= isos.length) return;
      const iso = isos[i];
      const ids = await fetchTherapistIds(clinic, courseId, iso);
      idsByIso.set(iso, ids === null ? null : new Set(ids));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, isos.length) }, worker));

  const dropReasons = [];
  const kept = slots.filter((s) => {
    let intersection = null;
    for (let k = 0; k < needed; k++) {
      const iso = addMinutesToIso(s.iso, k * SLOT_INCREMENT_MIN);
      const set = idsByIso.get(iso);
      if (set == null) return true;
      if (intersection === null) intersection = new Set(set);
      else intersection = new Set([...intersection].filter((id) => set.has(id)));
      if (intersection.size === 0) {
        dropReasons.push({ slot: s.iso, intersection: [], at: iso });
        return false;
      }
    }
    return intersection ? intersection.size > 0 : true;
  });

  // Build per-iso debug map (id list, or null on error)
  const debug = {};
  for (const [iso, set] of idsByIso) {
    debug[iso] = set === null ? null : Array.from(set);
  }
  return { kept, debug, dropReasons };
}

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
  const durationRaw = String(req.query.duration || '').trim();
  const duration = durationRaw && /^\d+$/.test(durationRaw) ? parseInt(durationRaw, 10) : null;
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

    let available = [];
    for (const day of slots) {
      for (const t of (day.available_times || [])) {
        available.push({ date: day.date, iso: t });
      }
    }
    // Snapshot of room-level availability (before per-course filtering) so the
    // client can keep the time axis stable even when some hours are completely
    // unbookable for the chosen course.
    const roomAvailable = available.slice();

    // When a specific course is requested, filter by per-therapist availability
    // checking *consecutive* 30-min slots so a 60-min course only stays
    // bookable when the same therapist is free for the whole duration.
    const beforeFilter = available.length;
    let courseFilterApplied = false;
    let courseFilterDebug = null;
    if (courseId && available.length > 0) {
      const r = await filterByBookableCourse(
        clinic,
        parseInt(courseId, 10),
        available,
        forNewBool,
      );
      available = r.kept;
      courseFilterApplied = true;
      courseFilterDebug = r.debug;
    }

    const payload = {
      clinic,
      start,
      end,
      courseId: courseId || null,
      duration: duration,
      forNew: forNewBool,
      available,
      _via: usedUrl ? new URL(usedUrl).pathname + (new URL(usedUrl).search || '') : null,
      _courseFilterApplied: courseFilterApplied,
      _beforeFilter: beforeFilter,
      // Used by the client to build a stable time axis even when some rows
      // become entirely unbookable for the selected course.
      axisAvailable: roomAvailable,
    };
    if (debug) {
      payload._raw = rawText;
      payload._upstreamUrls = tryUrls;
      payload._courseFilterDebug = courseFilterDebug;
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
