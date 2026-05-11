// Shared cache + telemetry for upstream threease calls.
// Both are best-effort — any failure is silently ignored so we never block
// the main request path. KV/Redis is shared with promos via the same env.

import { Redis } from '@upstash/redis';

let _redis = null;
function getRedis() {
  if (_redis !== null) return _redis;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) { _redis = false; return false; }
  try { _redis = new Redis({ url, token }); } catch { _redis = false; }
  return _redis;
}

// --------------- /courses?start_time=Y cache ---------------
// TTL keeps results fresh enough for accuracy while sharing across users.

const COURSES_TTL_SEC = 60;

function coursesCacheKey(clinic, forNewBool, startIso) {
  return `cc:${clinic}:${forNewBool ? 't' : 'f'}:${startIso}`;
}

export async function getCachedCourseIds(clinic, forNewBool, startIso) {
  const redis = getRedis();
  if (!redis) return undefined; // KV unavailable → caller falls through to live fetch
  try {
    const v = await redis.get(coursesCacheKey(clinic, forNewBool, startIso));
    // v === null  → no entry (treat as "miss" so caller fetches)
    // v === '__null__' → previously cached as upstream failure (don't refetch immediately)
    // Array   → cached id list
    if (v === null) return undefined;
    if (v === '__null__') return null;
    return v;
  } catch {
    return undefined;
  }
}

export async function setCachedCourseIds(clinic, forNewBool, startIso, ids) {
  const redis = getRedis();
  if (!redis) return;
  try {
    const v = ids === null ? '__null__' : ids;
    // Failures cached briefly so we don't hammer threease in repeated bursts.
    const ttl = ids === null ? 15 : COURSES_TTL_SEC;
    await redis.set(coursesCacheKey(clinic, forNewBool, startIso), v, { ex: ttl });
  } catch {}
}

// --------------- Telemetry counters ---------------
// Simple per-day counters so admin can see success rate / response time.

function ymdJst(date) {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
}

const STAT_TTL_SEC = 86400 * 7; // keep 7 days

export function recordUpstreamCall(kind, status, durationMs) {
  // Fire and forget — don't await.
  const redis = getRedis();
  if (!redis) return;
  const day = ymdJst(new Date());
  const base = `st:${day}:${kind}`;
  const tasks = [
    redis.incr(`${base}:total`),
    redis.incr(`${base}:${status}`),
  ];
  if (typeof durationMs === 'number' && status === 'ok') {
    tasks.push(redis.incrby(`${base}:dur_total`, Math.round(durationMs)));
    tasks.push(redis.incr(`${base}:dur_count`));
  }
  // Set expiry once (Redis ignores re-setting same ttl on already-counted key)
  tasks.push(redis.expire(`${base}:total`, STAT_TTL_SEC));
  Promise.allSettled(tasks).catch(() => {});
}

export async function readDailyStats(daysBack = 3) {
  const redis = getRedis();
  if (!redis) return null;
  const now = new Date();
  const days = [];
  for (let i = 0; i < daysBack; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    days.push(ymdJst(d));
  }
  const out = {};
  for (const day of days) {
    const kinds = ['courses', 'calendar'];
    const entry = {};
    for (const kind of kinds) {
      const base = `st:${day}:${kind}`;
      try {
        const [total, ok, fail, durTotal, durCount] = await Promise.all([
          redis.get(`${base}:total`),
          redis.get(`${base}:ok`),
          redis.get(`${base}:fail`),
          redis.get(`${base}:dur_total`),
          redis.get(`${base}:dur_count`),
        ]);
        const t = Number(total) || 0;
        const o = Number(ok) || 0;
        const f = Number(fail) || 0;
        const dt = Number(durTotal) || 0;
        const dc = Number(durCount) || 0;
        entry[kind] = {
          total: t,
          ok: o,
          fail: f,
          avgMs: dc > 0 ? Math.round(dt / dc) : null,
          successRate: t > 0 ? Math.round((o / t) * 1000) / 10 : null,
        };
      } catch { entry[kind] = null; }
    }
    out[day] = entry;
  }
  return out;
}
