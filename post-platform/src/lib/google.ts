import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

// Google Business Profile API（投稿・店舗一覧・実績）
export const GOOGLE_SCOPES = ["https://www.googleapis.com/auth/business.manage", "openid", "email"];

export function googleRedirectUri() {
  return `${process.env.NEXTAUTH_URL}/api/google/callback`;
}

export function googleAuthUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${json.error_description ?? json.error ?? res.status}`);
  return json as { access_token: string; expires_in: number; refresh_token?: string; id_token?: string };
}

export async function exchangeCode(code: string) {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: googleRedirectUri() });
  // id_token はトークンエンドポイントから直接受け取ったものなので署名検証は省略し、メールだけ読む
  let email: string | null = null;
  if (t.id_token) {
    try {
      email = JSON.parse(Buffer.from(t.id_token.split(".")[1], "base64url").toString()).email ?? null;
    } catch {
      email = null;
    }
  }
  return { refreshToken: t.refresh_token, email };
}

let cached: { token: string; exp: number } | null = null;

async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const conn = await prisma.googleConnection.findUnique({ where: { id: "default" } });
  if (!conn) throw new Error("Google アカウントが連携されていません（設定画面から連携してください）");
  const t = await tokenRequest({ refresh_token: decrypt(conn.refreshToken), grant_type: "refresh_token" });
  cached = { token: t.access_token, exp: Date.now() + t.expires_in * 1000 };
  return cached.token;
}

export function clearGoogleTokenCache() {
  cached = null;
}

async function gfetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${await accessToken()}`, "content-type": "application/json" },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Google API ${res.status}: ${json.error?.message ?? text.slice(0, 200)}`);
  return json as T;
}

// ---------- 店舗（ロケーション）一覧 ----------
export type GbpLocation = {
  accountId: string;
  locationId: string;
  title: string;
  address: string;
  category: string;
  websiteUri: string;
};

export async function listAllLocations(): Promise<GbpLocation[]> {
  const accounts: { name: string }[] = [];
  let pageToken = "";
  do {
    const r = await gfetch<{ accounts?: { name: string }[]; nextPageToken?: string }>(
      `https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=20${pageToken ? `&pageToken=${pageToken}` : ""}`,
    );
    accounts.push(...(r.accounts ?? []));
    pageToken = r.nextPageToken ?? "";
  } while (pageToken);

  type Loc = {
    name: string;
    title?: string;
    websiteUri?: string;
    storefrontAddress?: { administrativeArea?: string; locality?: string; addressLines?: string[] };
    categories?: { primaryCategory?: { displayName?: string } };
  };
  const out: GbpLocation[] = [];
  for (const acc of accounts) {
    let token = "";
    do {
      const r = await gfetch<{ locations?: Loc[]; nextPageToken?: string }>(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${acc.name}/locations?pageSize=100&readMask=name,title,storefrontAddress,categories,websiteUri${token ? `&pageToken=${token}` : ""}`,
      );
      for (const l of r.locations ?? []) {
        const a = l.storefrontAddress;
        out.push({
          accountId: acc.name.replace("accounts/", ""),
          locationId: l.name.replace("locations/", ""),
          title: l.title ?? "",
          address: [a?.administrativeArea, a?.locality, ...(a?.addressLines ?? [])].filter(Boolean).join(""),
          category: l.categories?.primaryCategory?.displayName ?? "",
          websiteUri: l.websiteUri ?? "",
        });
      }
      token = r.nextPageToken ?? "";
    } while (token);
  }
  // 同じ店舗が複数アカウント（グループ）経由で見える場合は 1 件にまとめる
  return [...new Map(out.map((l) => [l.locationId, l])).values()];
}

// ---------- 投稿 ----------
export async function createLocalPost(args: {
  accountId: string;
  locationId: string;
  summary: string;
  ctaType: string;
  ctaUrl: string;
  imageUrl?: string | null;
}) {
  const body: Record<string, unknown> = { languageCode: "ja", summary: args.summary, topicType: "STANDARD" };
  if (args.ctaType === "CALL") body.callToAction = { actionType: "CALL" };
  else if (args.ctaType !== "NONE" && args.ctaUrl) body.callToAction = { actionType: args.ctaType, url: args.ctaUrl };
  if (args.imageUrl) body.media = [{ mediaFormat: "PHOTO", sourceUrl: args.imageUrl }];

  const r = await gfetch<{ name: string }>(
    `https://mybusiness.googleapis.com/v4/accounts/${args.accountId}/locations/${args.locationId}/localPosts`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return r.name;
}

// ---------- 実績（Business Profile Performance API） ----------
export const METRICS = {
  CALL_CLICKS: "電話",
  WEBSITE_CLICKS: "ウェブサイト",
  BUSINESS_DIRECTION_REQUESTS: "ルート",
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: "表示（検索・スマホ）",
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: "表示（検索・PC）",
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: "表示（マップ・スマホ）",
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: "表示（マップ・PC）",
} as const;
export type MetricKey = keyof typeof METRICS;

export async function fetchMetrics(locationId: string, start: Date, end: Date): Promise<Record<MetricKey, number>> {
  const p = new URLSearchParams();
  for (const m of Object.keys(METRICS)) p.append("dailyMetrics", m);
  const set = (prefix: string, d: Date) => {
    p.set(`${prefix}.year`, String(d.getUTCFullYear()));
    p.set(`${prefix}.month`, String(d.getUTCMonth() + 1));
    p.set(`${prefix}.day`, String(d.getUTCDate()));
  };
  set("dailyRange.startDate", start);
  set("dailyRange.endDate", end);

  type R = {
    multiDailyMetricTimeSeries?: {
      dailyMetricTimeSeries?: { dailyMetric: MetricKey; timeSeries?: { datedValues?: { value?: string }[] } }[];
    }[];
  };
  const r = await gfetch<R>(
    `https://businessprofileperformance.googleapis.com/v1/locations/${locationId}:fetchMultiDailyMetricsTimeSeries?${p}`,
  );
  const totals = Object.fromEntries(Object.keys(METRICS).map((k) => [k, 0])) as Record<MetricKey, number>;
  for (const group of r.multiDailyMetricTimeSeries ?? []) {
    for (const s of group.dailyMetricTimeSeries ?? []) {
      totals[s.dailyMetric] = (s.timeSeries?.datedValues ?? []).reduce((n, v) => n + Number(v.value ?? 0), 0);
    }
  }
  return totals;
}

// 検索キーワード（月別の表示回数。少ない語は "threshold" で「〇未満」として返る）
export async function fetchSearchKeywords(locationId: string, year: number, month: number, limit = 20) {
  const p = new URLSearchParams({
    "monthlyRange.startMonth.year": String(year),
    "monthlyRange.startMonth.month": String(month),
    "monthlyRange.endMonth.year": String(year),
    "monthlyRange.endMonth.month": String(month),
    pageSize: "100",
  });
  type R = { searchKeywordsCounts?: { searchKeyword: string; insightsValue?: { value?: string; threshold?: string } }[] };
  const r = await gfetch<R>(`https://businessprofileperformance.googleapis.com/v1/locations/${locationId}/searchkeywords/impressions/monthly?${p}`);
  return (r.searchKeywordsCounts ?? [])
    .map((k) => ({ keyword: k.searchKeyword, count: Number(k.insightsValue?.value ?? 0), under: k.insightsValue?.threshold ? Number(k.insightsValue.threshold) : null }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
