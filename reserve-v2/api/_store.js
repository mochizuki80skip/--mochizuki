// reserve-v2 共通ストア（Upstash Redis）
//
// ■ 現行システム (reserve/) との分離について
//   現行システムはキー "reserve:promos" / "cc:*" / "st:*" を使っている。
//   v2 はすべてのキーを "rv2:" 接頭辞で分けているので、同じ Redis を
//   共有しても現行システムのデータを壊すことはない。
//   （本番切替時は移行スクリプトで rv2: 側へコピーする）

import { Redis } from '@upstash/redis';

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const e = new Error('Storage not configured. Connect Upstash Redis to this Vercel project.');
    e.code = 'storage_unconfigured';
    throw e;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

export function isStorageUnconfiguredError(err) {
  return err && err.code === 'storage_unconfigured';
}

export const KEY = {
  schedule: 'rv2:schedule',
  courses: 'rv2:courses',
  promos: 'rv2:promos',
  // 日付ごとの「埋まっている枠」。1日1キーで持つ。
  booked: (clinic, ymd) => `rv2:booked:${clinic}:${ymd}`,
};

export const CLINIC_IDS = ['192', '193'];
export const VISIT_MODES = ['first', 'returning', 'three_months'];

// -------------------------------------------------------------------
// 認証 / リクエスト
// -------------------------------------------------------------------

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

// -------------------------------------------------------------------
// 営業スケジュール
// -------------------------------------------------------------------
//   slotMin  … 予約枠の刻み（分）
//   clinics[id].capacity … 同時に施術できる人数（この数まで同じ枠を取れる）
//   clinics[id].week[dow] … 曜日ごとの営業時間帯（0=日 … 6=土）。複数可＝休憩で分割。
//   clinics[id].exceptions[YYYY-MM-DD]
//        { closed: true }                  … 臨時休診
//        { ranges: [{start,end}, ...] }    … その日だけ時間変更

export const DEFAULT_SCHEDULE = {
  slotMin: 30,
  clinics: {
    '192': {
      capacity: 1,
      week: {
        0: [{ start: '09:00', end: '18:00' }],
        1: [{ start: '10:00', end: '19:00' }],
        2: [{ start: '10:00', end: '19:00' }],
        3: [{ start: '10:00', end: '19:00' }],
        4: [{ start: '10:00', end: '19:00' }],
        5: [{ start: '10:00', end: '19:00' }],
        6: [{ start: '09:00', end: '18:00' }],
      },
      exceptions: {},
    },
    '193': {
      capacity: 1,
      week: {
        0: [{ start: '09:00', end: '18:00' }],
        1: [{ start: '10:00', end: '19:00' }],
        2: [{ start: '10:00', end: '19:00' }],
        3: [{ start: '10:00', end: '19:00' }],
        4: [{ start: '10:00', end: '19:00' }],
        5: [{ start: '10:00', end: '19:00' }],
        6: [{ start: '09:00', end: '18:00' }],
      },
      exceptions: {},
    },
  },
};

export async function getSchedule() {
  const redis = getRedis();
  const raw = await redis.get(KEY.schedule);
  return normalizeSchedule(raw);
}

export async function saveSchedule(schedule) {
  const redis = getRedis();
  const normalized = normalizeSchedule(schedule);
  await redis.set(KEY.schedule, normalized);
  return normalized;
}

function isHHMM(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function hhmmToMin(s) {
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

export function minToHhmm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// 壊れた値・欠けた値があってもそのまま使える形に整える。
// 管理画面からの保存値も、Redis から読んだ値も必ずここを通す。
export function normalizeSchedule(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const slotMinRaw = Number(src.slotMin);
  const slotMin = [10, 15, 20, 30, 60].includes(slotMinRaw) ? slotMinRaw : DEFAULT_SCHEDULE.slotMin;

  const clinics = {};
  for (const id of CLINIC_IDS) {
    const c = (src.clinics && typeof src.clinics === 'object' && src.clinics[id]) || {};
    const def = DEFAULT_SCHEDULE.clinics[id];

    const capRaw = Number(c.capacity);
    const capacity = Number.isFinite(capRaw) && capRaw >= 1 && capRaw <= 20
      ? Math.floor(capRaw) : def.capacity;

    const week = {};
    for (let dow = 0; dow <= 6; dow++) {
      const rawRanges = (c.week && c.week[dow] !== undefined) ? c.week[dow] : def.week[dow];
      week[dow] = normalizeRanges(rawRanges);
    }

    const exceptions = {};
    const rawEx = (c.exceptions && typeof c.exceptions === 'object') ? c.exceptions : {};
    for (const [ymd, val] of Object.entries(rawEx)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
      if (val && val.closed) {
        exceptions[ymd] = { closed: true };
      } else if (val && Array.isArray(val.ranges)) {
        const ranges = normalizeRanges(val.ranges);
        // 時間帯が1つも無い＝実質休診として扱う
        exceptions[ymd] = ranges.length ? { ranges } : { closed: true };
      }
    }

    clinics[id] = { capacity, week, exceptions };
  }
  return { slotMin, clinics };
}

// 時間帯の配列を掃除する:
//   ・HH:MM 形式でない / 開始 >= 終了 のものは捨てる
//   ・開始時刻順に並べ、重なり合う帯は1つにまとめる
function normalizeRanges(raw) {
  if (!Array.isArray(raw)) return [];
  const list = [];
  for (const r of raw) {
    if (!r || !isHHMM(r.start) || !isHHMM(r.end)) continue;
    const s = hhmmToMin(r.start);
    const e = hhmmToMin(r.end);
    if (e <= s) continue;
    list.push({ s, e });
  }
  list.sort((a, b) => a.s - b.s);
  const merged = [];
  for (const r of list) {
    const last = merged[merged.length - 1];
    if (last && r.s <= last.e) {
      last.e = Math.max(last.e, r.e);
    } else {
      merged.push({ ...r });
    }
  }
  return merged.map((r) => ({ start: minToHhmm(r.s), end: minToHhmm(r.e) }));
}

// その日の営業時間帯を返す（例外日を優先）。休診日は [] を返す。
export function rangesForDate(schedule, clinic, ymd, dow) {
  const c = schedule.clinics[clinic];
  if (!c) return [];
  const ex = c.exceptions[ymd];
  if (ex) {
    if (ex.closed) return [];
    if (Array.isArray(ex.ranges)) return ex.ranges;
  }
  return c.week[dow] || [];
}

// -------------------------------------------------------------------
// メニュー（コース）マスタ
// -------------------------------------------------------------------
//   { id, clinic: '192'|'193'|'both', visitModes: [...], name,
//     duration(分), price(円), description, order, active }

export async function listCourses() {
  const redis = getRedis();
  const items = await redis.get(KEY.courses);
  return Array.isArray(items) ? items.map(normalizeCourse).filter(Boolean) : [];
}

export async function saveCourses(items) {
  const redis = getRedis();
  const clean = (Array.isArray(items) ? items : []).map(normalizeCourse).filter(Boolean);
  clean.sort((a, b) => a.order - b.order);
  await redis.set(KEY.courses, clean);
  return clean;
}

export function normalizeCourse(c) {
  if (!c || typeof c !== 'object') return null;
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  if (!name) return null;
  const durationRaw = Number(c.duration);
  const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? Math.floor(durationRaw) : 30;
  const priceRaw = Number(c.price);
  const price = Number.isFinite(priceRaw) && priceRaw >= 0 ? Math.floor(priceRaw) : null;
  const clinic = ['192', '193', 'both'].includes(c.clinic) ? c.clinic : 'both';
  const visitModes = Array.isArray(c.visitModes)
    ? c.visitModes.filter((v) => VISIT_MODES.includes(v))
    : [];
  const orderRaw = Number(c.order);
  return {
    id: typeof c.id === 'string' && c.id ? c.id : newId('c'),
    clinic,
    visitModes: visitModes.length ? visitModes : [...VISIT_MODES],
    name,
    duration,
    price,
    description: typeof c.description === 'string' ? c.description.trim() : '',
    order: Number.isFinite(orderRaw) ? orderRaw : 0,
    active: c.active !== false,
  };
}

export function newId(prefix) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return `${prefix}-${out}`;
}

// -------------------------------------------------------------------
// 埋まり枠（予約済み）
// -------------------------------------------------------------------
//   1日1キー: { "10:00": 1, "10:30": 2 }  … その時刻に入っている件数

export async function getBookedMap(clinic, ymds) {
  const redis = getRedis();
  if (!ymds.length) return {};
  const keys = ymds.map((ymd) => KEY.booked(clinic, ymd));
  let values = [];
  try {
    values = await redis.mget(...keys);
  } catch {
    values = await Promise.all(keys.map((k) => redis.get(k).catch(() => null)));
  }
  const out = {};
  ymds.forEach((ymd, i) => {
    const v = values[i];
    out[ymd] = (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  });
  return out;
}

export async function setBookedForDate(clinic, ymd, map) {
  const redis = getRedis();
  const clean = {};
  for (const [time, countRaw] of Object.entries(map || {})) {
    if (!isHHMM(time)) continue;
    const n = Math.floor(Number(countRaw));
    if (Number.isFinite(n) && n > 0) clean[time] = n;
  }
  if (Object.keys(clean).length === 0) {
    await redis.del(KEY.booked(clinic, ymd));
  } else {
    await redis.set(KEY.booked(clinic, ymd), clean);
  }
  return clean;
}
