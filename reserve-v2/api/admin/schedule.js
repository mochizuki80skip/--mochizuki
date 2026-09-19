// 管理: 営業スケジュール（曜日ごとの営業時間・臨時休診・枠の刻み・同時施術人数）
//   GET  /api/admin/schedule      … 現在の設定を返す
//   POST /api/admin/schedule      … 設定を丸ごと保存する

import {
  checkAuth,
  readJsonBody,
  getSchedule,
  saveSchedule,
  isStorageUnconfiguredError,
} from '../_store.js';

export default async function handler(req, res) {
  const auth = checkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      return res.status(200).json({ schedule: await getSchedule() });
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      // normalizeSchedule が値の妥当性を担保するので、ここでは丸ごと渡す
      const saved = await saveSchedule(body.schedule || body);
      return res.status(200).json({ schedule: saved });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method not allowed' });
  } catch (err) {
    if (isStorageUnconfiguredError(err)) {
      return res.status(503).json({
        error: 'storage_unconfigured',
        message: 'Upstash Redis が未接続です。Vercel の Storage から接続してください。',
      });
    }
    return res.status(500).json({ error: 'schedule error', message: (err && err.message) || String(err) });
  }
}
