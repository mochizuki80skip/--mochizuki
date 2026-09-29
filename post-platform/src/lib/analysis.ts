import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { fetchMetrics, fetchSearchKeywords, type MetricKey } from "@/lib/google";
import { accountInsights, mediaInsights } from "@/lib/instagram";
import { storeChannels } from "@/lib/posts";
import { jstParts } from "@/lib/themes";

const DAY = 86400_000;

type GbpSummary = { impressions: number; calls: number; directions: number; website: number };
const gbpSummary = (m: Record<MetricKey, number>): GbpSummary => ({
  impressions:
    m.BUSINESS_IMPRESSIONS_MOBILE_SEARCH + m.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH + m.BUSINESS_IMPRESSIONS_MOBILE_MAPS + m.BUSINESS_IMPRESSIONS_DESKTOP_MAPS,
  calls: m.CALL_CLICKS,
  directions: m.BUSINESS_DIRECTION_REQUESTS,
  website: m.WEBSITE_CLICKS,
});

export type StoreRow = {
  store: string;
  gbp?: { cur: GbpSummary; prev: GbpSummary };
  keywords?: { keyword: string; count: number; under: number | null }[];
  ig?: { cur: Record<string, number>; prev: Record<string, number> };
  posted: { gbp: number; instagram: number };
  errors: string[];
};

export type ThemeRow = { theme: string; mode: string; mediaType: string; posts: number; reach: number; saved: number; shares: number; interactions: number };

export type ReportData = {
  period: { start: string; end: string };
  stores: StoreRow[];
  themes: ThemeRow[];
  topPosts: { store: string; theme: string; mediaType: string; reach: number; saved: number; caption: string }[];
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

// 直近 28 日（Google の反映遅れを考慮して 3 日前まで）と、その前の 28 日を集計
export async function collect(now = new Date()): Promise<ReportData> {
  const end = new Date(now.getTime() - 3 * DAY);
  const start = new Date(end.getTime() - 27 * DAY);
  const prevEnd = new Date(start.getTime() - DAY);
  const prevStart = new Date(prevEnd.getTime() - 27 * DAY);
  // 検索キーワードは前月分
  const { year, month } = jstParts(now);
  const kwYear = month === 1 ? year - 1 : year;
  const kwMonth = month === 1 ? 12 : month - 1;

  const stores = await prisma.store.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

  const rows = await mapLimit(stores, 4, async (s): Promise<StoreRow> => {
    const ch = storeChannels(s);
    const row: StoreRow = { store: s.name, posted: { gbp: 0, instagram: 0 }, errors: [] };
    if (ch.gbp) {
      try {
        const [cur, prev] = await Promise.all([fetchMetrics(s.gbpLocationId!, start, end), fetchMetrics(s.gbpLocationId!, prevStart, prevEnd)]);
        row.gbp = { cur: gbpSummary(cur), prev: gbpSummary(prev) };
      } catch (e) {
        row.errors.push(`GBP：${(e as Error).message}`);
      }
      row.keywords = await fetchSearchKeywords(s.gbpLocationId!, kwYear, kwMonth, 10).catch((e) => {
        row.errors.push(`検索キーワード：${(e as Error).message}`);
        return undefined;
      });
    }
    if (ch.instagram) {
      try {
        const token = decrypt(s.igAccessToken!);
        const [cur, prev] = await Promise.all([accountInsights(s.igUserId!, token, start, end), accountInsights(s.igUserId!, token, prevStart, prevEnd)]);
        row.ig = { cur, prev };
      } catch (e) {
        row.errors.push(`Instagram：${(e as Error).message}`);
      }
    }
    return row;
  });

  // このシステムから投稿した分の Instagram 投稿別インサイトを更新
  const sent = await prisma.delivery.findMany({
    where: { status: "sent", sentAt: { gte: start } },
    include: { post: { include: { store: true, batch: true } } },
  });
  await mapLimit(
    sent.filter((d) => d.channel === "instagram" && d.externalId && d.post.store.igAccessToken),
    4,
    async (d) => {
      try {
        const metrics = await mediaInsights(d.externalId!, decrypt(d.post.store.igAccessToken!));
        await prisma.delivery.update({ where: { id: d.id }, data: { metrics, metricsAt: new Date() } });
        d.metrics = metrics;
      } catch {
        /* 削除済みの投稿など */
      }
    },
  );

  for (const d of sent) {
    const r = rows.find((x) => x.store === d.post.store.name);
    if (r) r.posted[d.channel as "gbp" | "instagram"]++;
  }

  // テーマ・作成方法・媒体ごとの反応（Instagram）
  const themes = new Map<string, ThemeRow>();
  const topPosts: ReportData["topPosts"] = [];
  for (const d of sent) {
    if (d.channel !== "instagram" || !d.metrics) continue;
    const m = d.metrics as Record<string, number>;
    const b = d.post.batch;
    const key = `${b.theme}|${b.mode}|${b.mediaType}`;
    const t = themes.get(key) ?? { theme: b.theme, mode: b.mode, mediaType: b.mediaType, posts: 0, reach: 0, saved: 0, shares: 0, interactions: 0 };
    t.posts++;
    t.reach += m.reach ?? 0;
    t.saved += m.saved ?? 0;
    t.shares += m.shares ?? 0;
    t.interactions += m.total_interactions ?? 0;
    themes.set(key, t);
    topPosts.push({ store: d.post.store.name, theme: b.theme, mediaType: b.mediaType, reach: m.reach ?? 0, saved: m.saved ?? 0, caption: d.post.igCaption.slice(0, 80) });
  }
  topPosts.sort((a, b) => b.reach - a.reach);

  return {
    period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
    stores: rows,
    themes: [...themes.values()].sort((a, b) => b.reach / b.posts - a.reach / a.posts),
    topPosts: topPosts.slice(0, 5),
  };
}

// 集計結果から改善提案を作る
export async function suggest(data: ReportData) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY が設定されていません");
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const prompt = `あなたは接骨院チェーン（${data.stores.length} 店舗）の Google ビジネスプロフィール（GBP）と Instagram の運用アナリストです。
以下は ${data.period.start}〜${data.period.end} の 28 日間の実績（cur）と、その前の 28 日間（prev）です。
gbp.calls は電話ボタンのタップ数、directions はルート検索、website はウェブサイトのクリック、keywords は前月に検索された語句です。
themes / topPosts はこのシステムから投稿した Instagram 投稿の反応（テーマ・作成方法 ai/template・画像 image / リール reel 別）です。

${JSON.stringify(data)}

本部向けに、次の内容を JSON で返してください。数字の根拠を示し、データが足りない点は推測と明記すること。
- "summary"：Markdown。見出しは「全体の傾向」「伸びている店舗・落ちている店舗」「投稿内容の傾向（テーマ・画像/リール・テンプレート/AI）」「検索キーワードから見えるニーズ」「次の 2 週間でやること（優先順に 3〜5 個）」
- "themeIdeas"：次に投稿するとよいテーマ案を 6〜10 個（短い日本語。検索キーワードや季節を反映）

投稿内容の提案では、柔道整復師法の広告制限に従い「治る」「必ず」「No.1」、体験談、施術前後の比較、肩こり等への保険適用をうたう表現を勧めないこと。`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { summary: { type: "STRING" }, themeIdeas: { type: "ARRAY", items: { type: "STRING" } } },
          required: ["summary", "themeIdeas"],
        },
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${json.error?.message ?? "unknown"}`);
  const text = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const out = JSON.parse(text) as { summary: string; themeIdeas: string[] };
  return { summary: out.summary, themeIdeas: (out.themeIdeas ?? []).slice(0, 10) };
}

// レポートを作成（時間がかかるため、呼び出し側でバックグラウンド実行する）
export async function runReport(reportId: string) {
  try {
    const data = await collect();
    await prisma.analysisReport.update({
      where: { id: reportId },
      data: { data, periodStart: new Date(data.period.start), periodEnd: new Date(data.period.end) },
    });
    const s = await suggest(data);
    await prisma.analysisReport.update({ where: { id: reportId }, data: { status: "done", summary: s.summary, themeIdeas: s.themeIdeas } });
  } catch (e) {
    await prisma.analysisReport.update({ where: { id: reportId }, data: { status: "failed", error: e instanceof Error ? e.message : "unknown" } });
  }
}

export async function startReport(by: string) {
  const running = await prisma.analysisReport.findFirst({
    where: { status: "running", createdAt: { gte: new Date(Date.now() - 30 * 60_000) } },
  });
  if (running) return { report: running, created: false };
  const now = new Date();
  return { report: await prisma.analysisReport.create({ data: { createdBy: by, periodStart: now, periodEnd: now } }), created: true };
}
