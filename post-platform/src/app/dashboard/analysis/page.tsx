import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { ReportData } from "@/lib/analysis";
import { Markdown } from "@/components/Markdown";
import { StartReportButton, AutoRefresh } from "./ReportControls";

export const dynamic = "force-dynamic";

export default async function AnalysisPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const reports = await prisma.analysisReport.findMany({ orderBy: { createdAt: "desc" }, take: 12 });
  const report = (id && reports.find((r) => r.id === id)) || reports[0];
  const running = reports.some((r) => r.status === "running");
  const data = report?.data as ReportData | undefined;
  const hasData = !!data?.stores;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">実績・分析</h1>
        <StartReportButton disabled={running} />
      </div>
      {running && (
        <div className="bg-brand-light text-brand-dark rounded p-3 text-sm">
          集計・分析中です（全店舗で数分かかります）。この画面は自動で更新されます。
          <AutoRefresh />
        </div>
      )}
      {!report && <div className="bg-white border rounded p-6 text-sm text-gray-500">まだ分析はありません。「今すぐ分析」を押してください（毎週月曜の自動分析も設定できます）。</div>}

      {report?.status === "failed" && <div className="bg-red-50 text-red-700 rounded p-3 text-sm">分析に失敗しました：{report.error}</div>}

      {report?.status === "done" && (
        <section className="bg-white border rounded p-4 space-y-4">
          <div className="text-xs text-gray-500">
            {report.periodStart.toLocaleDateString("ja-JP")}〜{report.periodEnd.toLocaleDateString("ja-JP")} の 28 日間（前の 28 日間と比較）／作成：{report.createdAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
          </div>
          <Markdown text={report.summary} />
          {report.themeIdeas.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-1">次の投稿テーマ案（押すとその内容で作成画面を開きます）</div>
              <div className="flex flex-wrap gap-2">
                {report.themeIdeas.map((t) => (
                  <Link key={t} href={`/dashboard/batches/new?theme=${encodeURIComponent(t)}`} className="px-2 py-1 rounded border text-sm bg-brand-light text-brand-dark">
                    {t}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-gray-400">※ AI による提案です。数値の解釈や施策は本部で判断してください。</p>
        </section>
      )}

      {hasData && <StoreTables data={data!} />}

      {reports.length > 1 && (
        <div className="text-sm">
          <span className="text-gray-500">過去の分析：</span>
          {reports.map((r) => (
            <Link key={r.id} href={`/dashboard/analysis?id=${r.id}`} className={`ml-2 hover:underline ${r.id === report?.id ? "font-medium" : "text-brand"}`}>
              {r.createdAt.toLocaleDateString("ja-JP")}
              {r.status !== "done" && `（${r.status === "running" ? "実行中" : "失敗"}）`}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Diff({ cur, prev }: { cur: number; prev?: number }) {
  const d = prev ? Math.round(((cur - prev) / prev) * 100) : null;
  return (
    <td className="px-3 py-1.5 text-right whitespace-nowrap">
      {cur.toLocaleString()}
      {d !== null && <span className={`ml-1 text-xs ${d >= 0 ? "text-green-600" : "text-red-600"}`}>({d >= 0 ? "+" : ""}{d}%)</span>}
    </td>
  );
}

function StoreTables({ data }: { data: ReportData }) {
  const th = "px-3 py-2 font-medium text-right whitespace-nowrap";
  const hasIg = data.stores.some((s) => s.ig);
  return (
    <>
      <section className="bg-white border rounded overflow-x-auto">
        <div className="px-3 py-2 border-b text-sm font-medium">店舗別</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 font-medium text-left">店舗</th>
              <th className={th}>投稿数</th>
              <th className={th}>GBP 表示</th>
              <th className={th}>電話</th>
              <th className={th}>ルート</th>
              <th className={th}>サイト</th>
              {hasIg && <th className={th}>IG リーチ</th>}
              {hasIg && <th className={th}>IG 反応</th>}
              {hasIg && <th className={th}>フォロワー</th>}
            </tr>
          </thead>
          <tbody>
            {data.stores.map((s) => (
              <tr key={s.store} className="border-t">
                <td className="px-3 py-1.5">
                  {s.store}
                  {s.errors.length > 0 && <div className="text-xs text-red-600">{s.errors.join(" / ")}</div>}
                </td>
                <td className="px-3 py-1.5 text-right">{s.posted.gbp + s.posted.instagram}</td>
                {s.gbp ? (
                  <>
                    <Diff cur={s.gbp.cur.impressions} prev={s.gbp.prev.impressions} />
                    <Diff cur={s.gbp.cur.calls} prev={s.gbp.prev.calls} />
                    <Diff cur={s.gbp.cur.directions} prev={s.gbp.prev.directions} />
                    <Diff cur={s.gbp.cur.website} prev={s.gbp.prev.website} />
                  </>
                ) : (
                  <td colSpan={4} className="px-3 py-1.5 text-center text-gray-400">—</td>
                )}
                {hasIg &&
                  (s.ig ? (
                    <>
                      <Diff cur={s.ig.cur.reach ?? 0} prev={s.ig.prev.reach} />
                      <Diff cur={s.ig.cur.total_interactions ?? 0} prev={s.ig.prev.total_interactions} />
                      <td className="px-3 py-1.5 text-right">{(s.ig.cur.followers ?? 0).toLocaleString()}</td>
                    </>
                  ) : (
                    <td colSpan={3} className="px-3 py-1.5 text-center text-gray-400">—</td>
                  ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {data.themes.length > 0 && (
        <section className="bg-white border rounded overflow-x-auto">
          <div className="px-3 py-2 border-b text-sm font-medium">テーマ・作り方別の反応（Instagram・1 投稿あたり平均）</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 font-medium text-left">テーマ</th>
                <th className="px-3 py-2 font-medium text-left">作り方</th>
                <th className={th}>投稿数</th>
                <th className={th}>リーチ</th>
                <th className={th}>保存</th>
                <th className={th}>シェア</th>
                <th className={th}>反応</th>
              </tr>
            </thead>
            <tbody>
              {data.themes.map((t) => (
                <tr key={`${t.theme}${t.mode}${t.mediaType}`} className="border-t">
                  <td className="px-3 py-1.5">{t.theme}</td>
                  <td className="px-3 py-1.5 text-xs">{t.mode === "template" ? "テンプレート" : "AI"}・{t.mediaType === "reel" ? "リール" : "画像"}</td>
                  <td className="px-3 py-1.5 text-right">{t.posts}</td>
                  {[t.reach, t.saved, t.shares, t.interactions].map((v, i) => (
                    <td key={i} className="px-3 py-1.5 text-right">{Math.round(v / t.posts).toLocaleString()}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {data.stores.some((s) => s.keywords?.length) && (
        <section className="bg-white border rounded">
          <div className="px-3 py-2 border-b text-sm font-medium">前月の検索キーワード（上位 5 件）</div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 text-sm">
            {data.stores.filter((s) => s.keywords?.length).map((s) => (
              <div key={s.store}>
                <div className="font-medium">{s.store}</div>
                <ol className="text-gray-700 list-decimal pl-5">
                  {s.keywords!.slice(0, 5).map((k) => (
                    <li key={k.keyword}>{k.keyword} <span className="text-gray-400 text-xs">{k.under ? `${k.under}未満` : k.count}</span></li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
