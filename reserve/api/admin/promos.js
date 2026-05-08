// Admin CRUD for promos. Auth via X-Admin-Password header.

import { kv } from '@vercel/kv';
import {
  checkAuth,
  listPromos,
  savePromos,
  readJsonBody,
  validatePromo,
  normalizePromo,
} from '../_admin-helpers.js';

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      const items = await listPromos(kv);
      return res.status(200).json({ items });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const err = validatePromo(body);
      if (err) return res.status(400).json({ error: err });
      const normalized = normalizePromo(body);
      const items = await listPromos(kv);
      // Replace by code (codes are unique). If exists, overwrite. If new, append.
      const idx = items.findIndex((p) => p.code === normalized.code);
      if (idx >= 0) items[idx] = normalized; else items.push(normalized);
      await savePromos(kv, items);
      return res.status(200).json({ items });
    }

    if (req.method === 'DELETE') {
      const code = String(req.query.code || '').trim();
      if (!code) return res.status(400).json({ error: 'code is required' });
      const items = await listPromos(kv);
      const next = items.filter((p) => p.code !== code);
      await savePromos(kv, next);
      return res.status(200).json({ items: next });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({
      error: 'storage error',
      message: (err && err.message) || String(err),
    });
  }
}
