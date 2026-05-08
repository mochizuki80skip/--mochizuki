import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessPatient, requireAdmin } from "@/lib/guards";
import {
  getPatientById,
  listChartsForPatient,
  listDailyLogsForPatient,
  listDiagnosesForPatient,
  listVisitsForPatient,
} from "@/lib/db";
import { contentForType } from "@/lib/content";
import { getBaseUrl } from "@/lib/baseUrl";
import TrendChart from "@/components/TrendChart";
import PatientQRCode from "@/components/PatientQRCode";
import SymptomHeatmap from "@/components/SymptomHeatmap";
import TabNav, { activeTab } from "@/components/TabNav";
import AdminHeader from "../../AdminHeader";
import { getClinic } from "@/lib/clinics";
import StaffCalendarSection from "./StaffCalendarSection";
import { MARKER_META } from "@/components/chart/MarkerIcon";
import type {
  ChartMarkerType,
  ChartRecord,
  DiagnosisRow,
  Patient,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const ctx = requireAdmin();

  const patient = await getPatientById(params.id);
  if (!patient) notFound();
  if (!canAccessPatient(patient, ctx)) redirect("/admin/forbidden");

  const [diagnoses, logs, visits, charts] = await Promise.all([
    listDiagnosesForPatient(patient.id),
    listDailyLogsForPatient(patient.id),
    listVisitsForPatient(patient.id),
    listChartsForPatient(patient.id),
  ]);
  const baseUrl = getBaseUrl();
  const patientLoginUrl = `${baseUrl}/me?chart=${encodeURIComponent(patient.chart_number)}&name=${encodeURIComponent(patient.name)}`;

  const tab = activeTab(searchParams, "tab", "summary") ?? "summary";

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-12 fade-up">
      <AdminHeader role={ctx.role} />

      <div className="mb-3">
        <Link
          href="/admin"
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← 患者一覧
        </Link>
      </div>

      <PatientInfoCard patient={patient} />

      <TabNav
        items={[
          { key: "summary",  label: "概要" },
          { key: "calendar", label: "カレンダー" },
          { key: "charts",   label: "カルテ", badge: charts.length || undefined },
          { key: "analysis", label: "分析" },
        ]}
        defaultKey="summary"
      />

      {tab === "summary" && (
        <SummaryTab
          patient={patient}
          patientLoginUrl={patientLoginUrl}
          diagnoses={diagnoses}
          charts={charts}
          visitsCount={visits.length}
        />
      )}

      {tab === "calendar" && (
        <section>
          <p className="text-xs text-ink-500 mb-2">
            日付をタップすると、その日のデータと来院の追加・取り消しができます
          </p>
          <StaffCalendarSection
            patientId={patient.id}
            diagnoses={diagnoses}
            logs={logs}
            visits={visits}
          />
        </section>
      )}

      {tab === "charts" && (
        <ChartsTab patient={patient} charts={charts} visitsCount={visits.length} />
      )}

      {tab === "analysis" && (
        <AnalysisTab
          patient={patient}
          diagnoses={diagnoses}
          logs={logs}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

function PatientInfoCard({ patient }: { patient: Patient }) {
  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft mb-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] tracking-widest text-accent-600 font-bold mb-1">
            {patient.chart_number}
          </div>
          <h1 className="text-[24px] font-black text-ink-900 leading-tight">
            {patient.name}
          </h1>
          {patient.furigana && (
            <div className="text-xs text-ink-500 mt-0.5">{patient.furigana}</div>
          )}
        </div>
        <Link
          href={`/admin/patients/${patient.id}/edit`}
          className="shrink-0 rounded-full border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-accent hover:text-ink-900 transition"
        >
          編集
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
        <div>
          <div className="text-ink-400 tracking-widest mb-0.5">通院</div>
          <div className="text-ink-700 truncate">
            {getClinic(patient.clinic_id)?.name || (
              <span className="text-ink-400">未設定</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-ink-400 tracking-widest mb-0.5">生年月日</div>
          <div className="text-ink-700 tabular-nums">
            {patient.birth_date || "—"}
          </div>
        </div>
        <div>
          <div className="text-ink-400 tracking-widest mb-0.5">登録日</div>
          <div className="text-ink-700 tabular-nums">
            {patient.created_at
              ? formatDateTime(patient.created_at).slice(0, 10)
              : "—"}
          </div>
        </div>
      </div>
      {patient.notes && (
        <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2.5 text-xs text-ink-700 leading-relaxed whitespace-pre-wrap">
          {patient.notes}
        </div>
      )}
    </section>
  );
}

function SummaryTab({
  patient,
  patientLoginUrl,
  diagnoses,
  charts,
  visitsCount,
}: {
  patient: Patient;
  patientLoginUrl: string;
  diagnoses: DiagnosisRow[];
  charts: ChartRecord[];
  visitsCount: number;
}) {
  return (
    <>
      <section className="grid grid-cols-1 gap-2 mb-5">
        <Link
          href={`/diagnose?patient=${patient.id}`}
          className="block w-full text-center rounded-full bg-accent text-ink-900 font-bold text-sm py-2.5 shadow-soft hover:bg-accent-400 transition"
        >
          ＋ 体質診断を実施
        </Link>
        <Link
          href={`/admin/patients/${patient.id}?tab=charts`}
          className="block w-full text-center rounded-full border-2 border-ink-900 text-ink-900 font-bold text-sm py-2.5 hover:bg-ink-50 transition"
        >
          鍼灸カルテを開く
        </Link>
        <Link
          href={`/admin/patients/${patient.id}?tab=calendar`}
          className="block w-full text-center rounded-full border-2 border-sky-500 bg-white text-sky-700 font-bold text-sm py-2.5 hover:bg-sky-50 transition"
        >
          来院記録 ({visitsCount})
        </Link>
      </section>

      {/* QR コード（折りたたみ） */}
      <details className="rounded-2xl border border-ink-100 bg-white shadow-soft mb-5">
        <summary className="cursor-pointer px-5 py-3 text-xs tracking-widest text-ink-400 font-bold flex items-center justify-between">
          <span>マイページQRコード</span>
          <span className="text-ink-300 text-base leading-none">＋</span>
        </summary>
        <div className="px-5 pb-5 pt-1 flex flex-col items-center text-center">
          <PatientQRCode url={patientLoginUrl} />
          <p className="text-xs text-ink-500 leading-relaxed mt-2">
            患者がスマホで読み込むと、カルテ番号が入力済みの
            <br />
            ログイン画面が開きます
          </p>
          <p className="text-[10px] text-ink-400 mt-2 tabular-nums break-all">
            {patientLoginUrl}
          </p>
          <Link
            href={`/admin/patients/${patient.id}/qr`}
            className="mt-3 rounded-full border border-ink-200 text-ink-700 font-bold text-xs px-4 py-1.5 hover:border-accent transition"
          >
            印刷用カードを開く
          </Link>
        </div>
      </details>

      {/* 直近のカルテ プレビュー */}
      {charts.length > 0 && (
        <section className="mb-5">
          <SectionHeading
            title="直近のカルテ"
            link={{
              href: `/admin/patients/${patient.id}?tab=charts`,
              label: "すべて見る",
            }}
          />
          <Link
            href={`/admin/patients/${patient.id}/charts/${charts[0].id}`}
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
          <SectionHeading title="診断履歴" />
          <ul className="space-y-2">
            {diagnoses.slice(0, 3).map((d) => {
              const c = contentForType(d.type_key);
              const hasNote = !!d.staff_note;
              return (
                <li key={d.id}>
                  <Link
                    href={`/admin/patients/${patient.id}/diagnoses/${d.id}`}
                    className="block rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-soft hover:border-accent transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[11px] tracking-widest text-ink-400 tabular-nums w-32 shrink-0">
                        {formatDateTime(d.diagnosed_at)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-ink-900 truncate">
                          {c.name}
                        </div>
                      </div>
                      {hasNote && (
                        <span
                          className="text-accent-600 text-[10px] tracking-widest"
                          title="施術メモあり"
                        >
                          MEMO
                        </span>
                      )}
                      <span className="text-ink-300 text-lg leading-none">›</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

function ChartsTab({
  patient,
  charts,
  visitsCount,
}: {
  patient: Patient;
  charts: ChartRecord[];
  visitsCount: number;
}) {
  if (visitsCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
        来院記録がまだありません。
        <br />
        先にカレンダータブから来院日を記録してください。
      </div>
    );
  }
  return (
    <>
      <p className="text-xs text-ink-500 mb-3">
        来院ごとの施術カルテ。日付をタップで詳細・編集できます。新規作成はカレンダータブから来院日をタップしてください。
      </p>
      {charts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
          カルテはまだ作成されていません。
          <br />
          カレンダータブから来院日を選んで作成してください。
        </div>
      ) : (
        <ul className="space-y-2">
          {charts.map((c) => {
            const types = new Set<ChartMarkerType>(c.markers.map((m) => m.type));
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/patients/${patient.id}/charts/${c.id}`}
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
                          {Array.from(types).map((t) => (
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
      )}
    </>
  );
}

function AnalysisTab({
  patient,
  diagnoses,
  logs,
}: {
  patient: Patient;
  diagnoses: DiagnosisRow[];
  logs: Awaited<ReturnType<typeof listDailyLogsForPatient>>;
}) {
  return (
    <>
      <section className="mb-5">
        <SectionHeading
          title="体調記録"
          sub="直近14日のヒートマップ（タップで日次詳細）"
          link={{
            href: `/admin/patients/${patient.id}/analysis`,
            label: "詳細分析",
          }}
        />
        <SymptomHeatmap
          logs={logs}
          hrefForDate={(ymd) => `/admin/patients/${patient.id}/logs/${ymd}`}
          analysisHref={`/admin/patients/${patient.id}/analysis`}
        />
      </section>

      {diagnoses.length >= 2 && (
        <section className="mb-5 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
          <SectionHeading title="体質スコアの推移" />
          <div className="overflow-x-auto -mx-1 px-1">
            <TrendChart rows={diagnoses} />
          </div>
        </section>
      )}

      {diagnoses.length > 0 && (
        <section>
          <SectionHeading title="診断履歴" />
          <ul className="space-y-2">
            {diagnoses.map((d) => {
              const c = contentForType(d.type_key);
              const hasNote = !!d.staff_note;
              return (
                <li key={d.id}>
                  <Link
                    href={`/admin/patients/${patient.id}/diagnoses/${d.id}`}
                    className="block rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-soft hover:border-accent transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[11px] tracking-widest text-ink-400 tabular-nums w-32 shrink-0">
                        {formatDateTime(d.diagnosed_at)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-ink-900 truncate">
                          {c.name}
                        </div>
                      </div>
                      {hasNote && (
                        <span className="text-accent-600 text-[10px] tracking-widest">
                          MEMO
                        </span>
                      )}
                      <span className="text-ink-300 text-lg leading-none">›</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {diagnoses.length === 0 && logs.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
          記録がまだありません。
        </div>
      )}
    </>
  );
}

function SectionHeading({
  title,
  sub,
  link,
}: {
  title: string;
  sub?: string;
  link?: { href: string; label: string };
}) {
  return (
    <header className="mb-2 px-1 flex items-end justify-between gap-2">
      <div>
        <h2 className="text-sm font-black text-ink-900 leading-tight">
          {title}
        </h2>
        {sub && (
          <p className="text-[11px] text-ink-500 mt-0.5 leading-relaxed">{sub}</p>
        )}
      </div>
      {link && (
        <Link
          href={link.href}
          className="shrink-0 text-[11px] text-ink-500 hover:text-ink-900 underline"
        >
          {link.label}
        </Link>
      )}
    </header>
  );
}
