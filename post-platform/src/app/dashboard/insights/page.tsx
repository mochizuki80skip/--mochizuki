import { prisma } from "@/lib/prisma";
import { fetchMetrics, type MetricKey } from "@/lib/google";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 直近 28 日間と、その前の 28 日間を比較（Google の実績データは数日遅れで反映される）
export default async function InsightsPage() {
  const stores = await prisma.store.findMany({
    where: { isActive: true, gbpLocationId: { not: null } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const day = 86400_000;
  const end = new Date(Date.now() - 3 * day);
  const start = new Date(end.getTime() - 27 * day);
  const prevEnd = new Date(start.getTime() - day);
  const prevStart = new Date(prevEnd.getTime() - 27 * day);

  const [rows, posted] = await Promise.all([
    mapLimit(stores, 4, async (s) => {
      try {
        const [cur, prev] = await Promise.all([
          fetchMetrics(s.gbpLocationId!, start, end),
          fetchMetrics(s.gbpLocationId!, prevStart, prevEnd),
        ]);
        return { store: s, cur, prev, error: null as string | null };
      } catch (e) {
        return { store: s, cur: null, prev: null, error: e instanceof Error ? e.message : "取得失敗" };
      }
    }),
    prisma.delivery.groupBy({
      by: ["postId"],
      where: { channel: "gbp", status: "sent", sentAt: { gte: start } },
    }).then(async (g) => {
      const posts = await prisma.post.findMany({ where: { id: { in: g.map((x) => x.postId) } }, select: { storeId: true } });
      return posts.reduce<Record<string, number>>((m, p) => ((m[p.storeId] = (m[p.storeId] ?? 0) + 1), m), {});
    }),
  ]);

  const impressions = (m: Record<MetricKey, number>) =>
    m.BUSINESS_IMPRESSIONS_MOBILE_SEARCH + m.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH + m.BUSINESS_IMPRESSIONS_MOBILE_MAPS + m.BUSINESS_IMPRESSIONS_DESKTOP_MAPS;
  const cols: [string, (m: Record<MetricKey, number>) => number][] = [
    ["表示回数", impressions],
    ["電話", (m) => m.CALL_CLICKS],
    ["ルート", (m) => m.BUSINESS_DIRECTION_REQUESTS],
    ["ウェブサイト", (m) => m.WEBSITE_CLICKS],
  ];
  const ok = rows.filter((r) => r.cur && r.prev);
  const fmt = (d: Date) => d.toLocaleDateString("ja-JP", { timeZone: "UTC", month: "numeric", day: "numeric" });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">実績（GBP）</h1>
      <p className="text-sm text-gray-500">
        {fmt(start)}〜{fmt(end)} の 28 日間。（ ）内は前の 28 日間との比較。電話は「電話ボタンのタップ数」です。
      </p>
      <div className="bg-white border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">店舗</th>
              <th className="px-3 py-2 font-medium text-right">投稿数</th>
              {cols.map(([l]) => (
                <th key={l} className="px-3 py-2 font-medium text-right">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.store.id} className="border-t">
                <td className="px-3 py-2">{r.store.name}</td>
                <td className="px-3 py-2 text-right">{posted[r.store.id] ?? 0}</td>
                {r.cur && r.prev ? (
                  cols.map(([l, f]) => <Cell key={l} cur={f(r.cur!)} prev={f(r.prev!)} />)
                ) : (
                  <td colSpan={cols.length} className="px-3 py-2 text-xs text-red-600">{r.error}</td>
                )}
              </tr>
            ))}
            {ok.length > 1 && (
              <tr className="border-t bg-gray-50 font-medium">
                <td className="px-3 py-2">合計</td>
                <td className="px-3 py-2 text-right">{Object.values(posted).reduce((a, b) => a + b, 0)}</td>
                {cols.map(([l, f]) => (
                  <Cell key={l} cur={ok.reduce((n, r) => n + f(r.cur!), 0)} prev={ok.reduce((n, r) => n + f(r.prev!), 0)} />
                ))}
              </tr>
            )}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">GBP 連携済みの店舗がありません。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ cur, prev }: { cur: number; prev: number }) {
  const diff = prev ? Math.round(((cur - prev) / prev) * 100) : null;
  return (
    <td className="px-3 py-2 text-right whitespace-nowrap">
      {cur.toLocaleString()}
      {diff !== null && (
        <span className={`ml-1 text-xs ${diff >= 0 ? "text-green-600" : "text-red-600"}`}>
          ({diff >= 0 ? "+" : ""}{diff}%)
        </span>
      )}
    </td>
  );
}

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
