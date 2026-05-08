import Link from "next/link";
import { requirePatient } from "@/lib/guards";
import {
  listChartsForPatient,
  listDailyLogsForPatient,
  listDiagnosesForPatient,
} from "@/lib/db";
import { contentForType } from "@/lib/content";
import TrendChart from "@/components/TrendChart";
import SymptomHeatmap from "@/components/SymptomHeatmap";
import SymptomRanking from "@/components/SymptomRanking";
import PainBodyDiagram from "@/components/PainBodyDiagram";
import TabNav, { activeTab } from "@/components/TabNav";
import PatientHeader from "../PatientHeader";
import { getClinic } from "@/lib/clinics";
import { listVisitsForPatient } from "@/lib/db";
import PatientCalendarSection from "./PatientCalendarSection";
import { aggregatePainsForLogs } from "@/lib/analysis";
import { MARKER_META } from "@/components/chart/MarkerIcon";
import type { ChartMarkerType } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function PatientDashboard({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const patient = await requirePatient();

  // Wrap data fetching so any single query failure shows a recoverable error
  // instead of crashing the whole page with a generic server-side exception.
  let diagnoses: Awaited<ReturnType<typeof listDiagnosesForPatient>> = [];
  let logs: Awaited<ReturnType<typeof listDailyLogsForPatient>> = [];
  let visits: Awaited<ReturnType<typeof listVisitsForPatient>> = [];
  let charts: Awaited<ReturnType<typeof listChartsForPatient>> = [];
  let dataError: string | null = null;
  try {
    [diagnoses, logs, visits, charts] = await Promise.all([
      listDiagnosesForPatient(patient.id),
      listDailyLogsForPatient(patient.id),
      listVisitsForPatient(patient.id),
      listChartsForPatient(patient.id),
    ]);
  } catch (e) {
    dataError =
      e instanceof Error ? e.message : "データの取得に失敗しました";
    // eslint-disable-next-line no-console
    console.error("[me/dashboard] data fetch failed:", e);
  }
  const clinic = getClinic(patient.clinic_id);

  const today = todayKey();
  const fourteenDaysAgo = shiftDays(today, -13);
  const recentPains = aggregatePainsForLogs(logs, fourteenDaysAgo, today);

  const tab = activeTab(searchParams, "tab", "home");

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12 fade-up">
      <PatientHeader />

      <section className="mb-3">
        <div className="text-[11px] tracking-widest text-accent-600 font-bold mb-1">
          {patient.chart_number}
        </div>
        <h1 className="text-[22px] font-black text-ink-900">
          {patient.name} さんのマイページ
        </h1>
      </section>

      <TabNav
        current={tab}
        items={[
          { key: "home", label: "ホーム" },
          { key: "calendar", label: "カレンダー" },
          { key: "charts", label: "カルテ", badge: charts.length || undefined },
          { key: "analysis", label: "分析" },
        ]}
      />

      {dataError && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
          データの取得に失敗しました: {dataError}
        </div>
      )}

      {tab === "home" && (
        <HomeTab clinic={clinic} diagnoses={diagnoses} charts={charts} />
      )}

      {tab === "calendar" && (
        <section>
          <PatientCalendarSection
            diagnoses={diagnoses}
            logs={logs}
            visits={visits}
          />
        </section>
      )}

      {tab === "charts" && (
        <ChartsTab patientName={patient.name} charts={charts} />
      )}

      {tab === "analysis" && (
        <AnalysisTab
          logs={logs}
          diagnoses={diagnoses}
          recentPains={recentPains}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

function HomeTab({
  clinic,
  diagnoses,
  charts,
}: {
  clinic: ReturnType<typeof getClinic>;
  diagnoses: Awaited<ReturnType<typeof listDiagnosesForPatient>>;
  charts: Awaited<ReturnType<typeof listChartsForPatient>>;
}) {
  return (
    <>
      <p className="text-xs text-ink-500 mb-4">
        カレンダーの日付をタップすると、その日の体調を記録・確認できます
      </p>

      <Link
        href={`/me/log/${todayKey()}`}
        className="block w-full text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition mb-3"
      >
        ＋ 今日の体調を記録する
      </Link>

      {clinic?.reservation_url ? (
        <a
          href={clinic.reservation_url}
          target="_blank"
          rel="noopener noreferrer"
          className="group mb-6 flex items-center justify-between rounded-full bg-ink-900 text-white font-black tracking-widest py-4 px-5 shadow-soft hover:bg-ink-800 active:scale-[0.99] transition"
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-ink-900"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 4v3M17 4v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="flex flex-col items-start">
              <span className="text-[10px] tracking-widest text-accent leading-none">
                {clinic.name}
              </span>
              <span className="text-sm leading-tight mt-0.5">来院予約する</span>
            </span>
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-ink-300 group-hover:text-white transition"
          >
            <path
              d="M14 4h6v6M20 4l-9 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      ) : (
        <div className="mb-6 rounded-full border border-dashed border-ink-200 text-ink-400 text-xs text-center py-3 px-5">
          {clinic
            ? "予約サイトURLが未設定です（院にお問い合わせください）"
            : "通院されている院が未設定です（院にお問い合わせください）"}
        </div>
      )}

      {/* 直近のカルテプレビュー */}
      {charts.length > 0 && (
        <section className="mb-6">
          <SectionHeading title="直近の施術カルテ" />
          <Link
            href={`/me/charts/${charts[0].id}`}
            className="block rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-soft hover:border-accent transition"
          >
            <div className="flex items-center gap-3">
              <div className="text-[11px] tracking-widest text-ink-400 tabular-nums w-24 shrink-0">
                {formatDateShort(charts[0].created_at)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-ink-900">
                  マーカー {charts[0].markers.length} 件
                </div>
              </div>
              <span className="text-ink-300 text-lg leading-none">›</span>
            </div>
          </Link>
        </section>
      )}

      {/* 最近の診断結果 */}
      {diagnoses.length > 0 && (
        <section>
          <SectionHeading title="最近の診断結果" sub="院で受けた体質診断" />
          <ul className="space-y-2">
            {diagnoses.slice(0, 3).map((d) => {
              const c = contentForType(d.type_key);
              return (
                <li key={d.id}>
                  <Link
                    href={`/me/diagnoses/${d.id}`}
                    className="block rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-soft hover:border-accent transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[11px] tracking-widest text-ink-400 tabular-nums">
                        {formatDateTime(d.diagnosed_at)}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <div className="text-sm font-bold text-ink-900 truncate">
                          {c.name}
                        </div>
                      </div>
                      <span className="text-ink-300 text-lg leading-none">›</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {diagnoses.length === 0 && charts.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
          まだ記録がありません。
          <br />
          上のボタンから今日の体調を記録してみましょう。
        </div>
      )}
    </>
  );
}

function ChartsTab({
  patientName,
  charts,
}: {
  patientName: string;
  charts: Awaited<ReturnType<typeof listChartsForPatient>>;
}) {
  if (charts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
        {patientName} さんのカルテはまだありません。
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {charts.map((c) => {
        const types = new Set<ChartMarkerType>(c.markers.map((m) => m.type));
        return (
          <li key={c.id}>
            <Link
              href={`/me/charts/${c.id}`}
              className="block rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-soft hover:border-accent transition"
            >
              <div className="flex items-center gap-3">
                <div className="text-[11px] tracking-widest text-ink-400 tabular-nums w-24 shrink-0">
                  {formatDateShort(c.created_at)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-ink-900">
                    マーカー {c.markers.length} 件
                  </div>
                  {types.size > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {Array.from(types)
                        .slice(0, 4)
                        .map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-ink-50 text-ink-700"
                          >
                            <span
                              aria-hidden
                              className="inline-block w-1.5 h-1.5 rounded-full"
                              style={{ background: MARKER_META[t].color }}
                            />
                            {MARKER_META[t].label}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
                <span className="text-ink-300 text-lg leading-none">›</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function AnalysisTab({
  logs,
  diagnoses,
  recentPains,
}: {
  logs: Awaited<ReturnType<typeof listDailyLogsForPatient>>;
  diagnoses: Awaited<ReturnType<typeof listDiagnosesForPatient>>;
  recentPains: ReturnType<typeof aggregatePainsForLogs>;
}) {
  return (
    <>
      <SectionHeading
        title="直近14日の体調"
        sub="毎日の気分と不調の項目数を一覧表示"
      />
      <section className="mb-6">
        <SymptomHeatmap logs={logs} hrefForDate={(ymd) => `/me/log/${ymd}`} />
      </section>

      <SectionHeading
        title="多かった不調"
        sub="不調が出た部位を体マップで可視化、頻度と強度の詳細"
      />
      <section className="mb-6 space-y-3">
        <PainBodyDiagram pains={recentPains} />
        <SymptomRanking
          logs={logs}
          days={14}
          title="頻度と強度の詳細"
          topN={8}
        />
      </section>

      {diagnoses.length >= 2 && (
        <>
          <SectionHeading
            title="体質スコアの推移"
            sub="3軸の変化を時系列で確認"
          />
          <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
            <div className="overflow-x-auto -mx-1 px-1">
              <TrendChart rows={diagnoses} />
            </div>
          </section>
        </>
      )}

      {logs.length === 0 && diagnoses.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
          記録がまだありません。
        </div>
      )}
    </>
  );
}

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-3 px-1">
      <h2 className="text-base font-black text-ink-900 leading-tight">{title}</h2>
      {sub && (
        <p className="text-[11px] text-ink-500 mt-0.5 leading-relaxed">{sub}</p>
      )}
    </header>
  );
}
