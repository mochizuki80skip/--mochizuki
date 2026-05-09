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
  const forNew = String(req.query.for_new || 'false') === 'true';

  if (!ALLOWED_CLINICS.has(clinic)) {
    return res.status(400).json({ error: 'invalid clinic' });
  }

  const url = `${UPSTREAM_BASE}/${clinic}/courses?per=100&page=1&home=false&for_new_customers=${forNew}`;

  try {
    const r = await fetch(url, { headers: UPSTREAM_HEADERS });
    if (!r.ok) {
      return res.status(502).json({ error: 'upstream error', status: r.status });
    }
    const rawText = await r.text();
    let data;
    try { data = JSON.parse(rawText); } catch { data = null; }
    const courses = ((data && data.courses) || []).map((c) => {
      let name = c.product_name || c.name;
      // Display rename: threease の「3ヶ月ご来院の無い方はこちら」を
      // 院側ご希望の表示名「【久しぶり】コンビネーション施術」に置換。
      if (/3\s*[ヶヵか]\s*月/.test(name || '')) {
        name = '【久しぶり】コンビネーション施術';
      }
      return {
        id: c.id,
        name,
        description: c.description || '',
        duration: c.duration,
        price: c.price,
      };
    });

    const debug = req.query.debug === '1';
    const payload = { clinic, for_new: forNew, courses };
    if (debug) payload._raw = rawText;

    // Course list rarely changes -> cache for 24 hours at the edge.
    res.setHeader('Cache-Control', debug ? 'no-store' : 's-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).json(payload);
  } catch (err) {
    return res.status(502).json({
      error: 'fetch failed',
      message: (err && err.message) || String(err),
    });
  }
}
