// 管理: メニュー（コース）マスタ
//   GET    /api/admin/courses            … 全件
//   POST   /api/admin/courses            … 1件の追加/更新（id があれば更新）
//   DELETE /api/admin/courses?id=c-xxxx  … 削除

import {
  checkAuth,
  readJsonBody,
  listCourses,
  saveCourses,
  normalizeCourse,
  newId,
  isStorageUnconfiguredError,
} from '../_store.js';

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ courses: await listCourses() });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);

      // 並び替えだけの保存（{ order: ['c-a','c-b', ...] }）
      if (Array.isArray(body.order)) {
        const items = await listCourses();
        const rank = new Map(body.order.map((id, i) => [id, i]));
        for (const c of items) {
          if (rank.has(c.id)) c.order = rank.get(c.id);
        }
        return res.status(200).json({ courses: await saveCourses(items) });
      }

      const incoming = normalizeCourse({ ...body, id: body.id || newId('c') });
      if (!incoming) return res.status(400).json({ error: 'メニュー名を入力してください' });

      const items = await listCourses();
      const idx = items.findIndex((c) => c.id === incoming.id);
      if (idx >= 0) {
        incoming.order = items[idx].order;
        items[idx] = incoming;
      } else {
        incoming.order = items.length ? Math.max(...items.map((c) => c.order)) + 1 : 0;
        items.push(incoming);
      }
      return res.status(200).json({ courses: await saveCourses(items), saved: incoming });
    }

    if (req.method === 'DELETE') {
      const id = String(req.query.id || '').trim();
      if (!id) return res.status(400).json({ error: 'id is required' });
      const items = await listCourses();
      return res.status(200).json({ courses: await saveCourses(items.filter((c) => c.id !== id)) });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    if (isStorageUnconfiguredError(err)) {
      return res.status(503).json({
        error: 'storage_unconfigured',
        message: 'Upstash Redis が未接続です。Vercel の Storage から接続してください。',
      });
    }
    return res.status(500).json({ error: 'courses error', message: (err && err.message) || String(err) });
  }
}
