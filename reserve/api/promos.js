// Public read-only endpoint: returns the promo menus for a given code.
// If the code does not match any active promo, returns empty.

import { kv } from '@vercel/kv';
import { listPromos } from './_admin-helpers.js';

export default async function handler(req, res) {
  const code = String(req.query.code || '').trim();

  if (!code) {
    res.setHeader('Cache-Control', 's-maxage=60');
    return res.status(200).json({ menus: [] });
  }

  try {
    const all = await listPromos(kv);
    const matched = all.filter((p) => p.code === code);
    // Strip the code from public response (defense in depth - though it's known by the requester)
    const menus = matched.map((p) => ({
      id: 'promo-' + p.code + '-' + (p.name || '').slice(0, 8),
      name: p.name,
      description: p.description || '',
      duration: p.duration,
      price: p.price,
      forClinic: p.forClinic || 'both',
      forFirstTime: p.forFirstTime || 'both',
    }));
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ menus });
  } catch (err) {
    return res.status(200).json({ menus: [], error: 'storage unavailable' });
  }
}
