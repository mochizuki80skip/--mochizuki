// Shared helpers for admin endpoints.

export function checkAuth(req) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return { ok: false, status: 500, error: 'ADMIN_PASSWORD env var is not set' };
  }
  const provided =
    (req.headers && (req.headers['x-admin-password'] || req.headers['X-Admin-Password'])) || '';
  if (provided !== expected) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  return { ok: true };
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const PROMO_KEY = 'reserve:promos';

export async function listPromos(kv) {
  const items = await kv.get(PROMO_KEY);
  return Array.isArray(items) ? items : [];
}

export async function savePromos(kv, items) {
  await kv.set(PROMO_KEY, items);
}

export function validatePromo(p) {
  if (!p || typeof p !== 'object') return 'invalid body';
  if (!p.code || typeof p.code !== 'string') return 'code is required';
  if (!/^[a-zA-Z0-9_-]{3,40}$/.test(p.code)) return 'code must be 3-40 chars (letters, numbers, _, -)';
  if (!p.name || typeof p.name !== 'string') return 'name is required';
  if (typeof p.duration !== 'number' && p.duration !== null && p.duration !== undefined) return 'duration must be a number';
  if (typeof p.price !== 'number' && p.price !== null && p.price !== undefined) return 'price must be a number';
  const validClinic = !p.forClinic || ['both', '192', '193'].includes(p.forClinic);
  if (!validClinic) return 'forClinic must be both/192/193';
  const validFt = !p.forFirstTime || ['both', 'true', 'false'].includes(p.forFirstTime);
  if (!validFt) return 'forFirstTime must be both/true/false';
  return null;
}

export function normalizePromo(p) {
  return {
    code: String(p.code).trim(),
    name: String(p.name).trim(),
    description: p.description ? String(p.description) : '',
    duration: typeof p.duration === 'number' ? p.duration : null,
    price: typeof p.price === 'number' ? p.price : null,
    forClinic: p.forClinic || 'both',
    forFirstTime: p.forFirstTime || 'both',
    updatedAt: new Date().toISOString(),
  };
}
