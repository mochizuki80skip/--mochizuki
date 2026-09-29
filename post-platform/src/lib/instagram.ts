// Instagram Graph API（Instagram ログインの API）
// 事前に各店舗の Instagram をプロアカウント（ビジネス / クリエイター）にし、
// Meta for Developers のアプリで発行した長期アクセストークンを店舗設定に登録しておく。
// ※ ID・パスワードでのログイン操作の自動化は Instagram の規約違反・ロックの原因になるため行わない。
const base = () => `https://graph.instagram.com/${process.env.IG_GRAPH_VERSION ?? "v23.0"}`;

async function igFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`Instagram API ${res.status}: ${json.error?.message ?? "unknown"}`);
  return json as T;
}
const form = (token: string, o: Record<string, string>) => new URLSearchParams({ ...o, access_token: token });
const q = (token: string) => `access_token=${encodeURIComponent(token)}`;

// メディアコンテナ作成（画像 or リール）
export async function createContainer(igUserId: string, token: string, m: { imageUrl?: string | null; videoUrl?: string | null; caption: string }) {
  const params: Record<string, string> = m.videoUrl
    ? { media_type: "REELS", video_url: m.videoUrl, caption: m.caption, share_to_feed: "true", ...(m.imageUrl ? { cover_url: m.imageUrl } : {}) }
    : { image_url: m.imageUrl!, caption: m.caption };
  const c = await igFetch<{ id: string }>(`${base()}/${igUserId}/media`, { method: "POST", body: form(token, params) });
  return c.id;
}

export async function containerStatus(containerId: string, token: string) {
  const s = await igFetch<{ status_code?: string; status?: string }>(`${base()}/${containerId}?fields=status_code,status&${q(token)}`);
  return { code: s.status_code ?? "IN_PROGRESS", detail: s.status ?? "" };
}

export async function publishContainer(igUserId: string, token: string, containerId: string) {
  const p = await igFetch<{ id: string }>(`${base()}/${igUserId}/media_publish`, {
    method: "POST",
    body: form(token, { creation_id: containerId }),
  });
  return p.id;
}

// 画像はその場で公開まで行う。リールは処理に時間がかかるため、コンテナ ID を返して次回の Cron で公開する
export async function startPublish(igUserId: string, token: string, m: { imageUrl?: string | null; videoUrl?: string | null; caption: string }) {
  const id = await createContainer(igUserId, token, m);
  if (m.videoUrl) return { state: "processing" as const, containerId: id };
  for (let i = 0; i < 5; i++) {
    const s = await containerStatus(id, token);
    if (s.code === "FINISHED") break;
    if (s.code === "ERROR" || s.code === "EXPIRED") throw new Error(`Instagram 画像の取り込みに失敗（${s.code} ${s.detail}）`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { state: "sent" as const, mediaId: await publishContainer(igUserId, token, id) };
}

// 長期トークン（60 日）の延長
export async function refreshToken(token: string) {
  const r = await igFetch<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&${q(token)}`,
  );
  return { token: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000) };
}

// ---------- インサイト ----------
// 指標は API のバージョンで廃止・改名されることがあるため、まとめて取れなければ 1 つずつ取り、取れないものは飛ばす
async function insights(url: (metrics: string) => string, metrics: string[], pick: (d: InsightRow) => number) {
  const out: Record<string, number> = {};
  const read = (rows: InsightRow[]) => rows.forEach((d) => (out[d.name] = pick(d)));
  try {
    read((await igFetch<{ data: InsightRow[] }>(url(metrics.join(",")))).data);
  } catch {
    for (const m of metrics) {
      try {
        read((await igFetch<{ data: InsightRow[] }>(url(m))).data);
      } catch {
        /* この指標は取得不可 */
      }
    }
  }
  return out;
}
type InsightRow = { name: string; values?: { value: number }[]; total_value?: { value: number } };

export const IG_ACCOUNT_METRICS = ["reach", "views", "accounts_engaged", "total_interactions", "profile_links_taps"];
export const IG_MEDIA_METRICS = ["reach", "views", "likes", "comments", "saved", "shares", "total_interactions"];

export async function accountInsights(igUserId: string, token: string, since: Date, until: Date) {
  const s = Math.floor(since.getTime() / 1000);
  const u = Math.floor(until.getTime() / 1000);
  const metrics = await insights(
    (m) => `${base()}/${igUserId}/insights?metric=${m}&period=day&metric_type=total_value&since=${s}&until=${u}&${q(token)}`,
    IG_ACCOUNT_METRICS,
    (d) => d.total_value?.value ?? (d.values ?? []).reduce((n, v) => n + (v.value ?? 0), 0),
  );
  const profile = await igFetch<{ followers_count?: number; media_count?: number }>(
    `${base()}/${igUserId}?fields=followers_count,media_count&${q(token)}`,
  ).catch(() => ({}) as { followers_count?: number; media_count?: number });
  return { ...metrics, followers: profile.followers_count ?? 0 };
}

export async function mediaInsights(mediaId: string, token: string) {
  return insights(
    (m) => `${base()}/${mediaId}/insights?metric=${m}&${q(token)}`,
    IG_MEDIA_METRICS,
    (d) => d.total_value?.value ?? d.values?.[0]?.value ?? 0,
  );
}
