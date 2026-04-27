import Link from "next/link";
import { requirePatient } from "@/lib/guards";
import { listDailyLogsForPatient, listDiagnosesForPatient } from "@/lib/db";
import { contentForType } from "@/lib/content";
import HistoryCalendar from "@/components/HistoryCalendar";
import TrendChart from "@/components/TrendChart";
import SymptomHeatmap from "@/components/SymptomHeatmap";
import SymptomRanking from "@/components/SymptomRanking";
import PatientHeader from "../PatientHeader";
import { getClinic } from "@/lib/clinics";
import { listVisitsForPatient } from "@/lib/db";
import VisitButton from "./VisitButton";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function PatientDashboard() {
  const patient = await requirePatient();
  const [diagnoses, logs, visits] = await Promise.all([
    listDiagnosesForPatient(patient.id),
    listDailyLogsForPatient(patient.id),
    listVisitsForPatient(patient.id),
  ]);
  const clinic = getClinic(patient.clinic_id);
  const today = todayKey();
  const recordedToday = visits.some((v) => v.visit_date === today);

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12 fade-up">
      <PatientHeader />

      <section className="mb-6">
        <div className="text-[11px] tracking-widest text-accent-600 font-bold mb-1">
          {patient.chart_number}
        </div>
        <h1 className="text-[22px] font-black text-ink-900">
          {patient.name} さんのマイページ
        </h1>
        <p className="text-xs text-ink-500 mt-1">
          カレンダーの日付をタップすると、その日の体調を記録・確認できます
        </p>
      </section>

      <Link
        href={`/me/log/${todayKey()}`}
        className="block w-full text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition mb-3"
      >
        ＋ 今日の体調を記録する
      </Link>

      <VisitButton recordedToday={recordedToday} todayKey={today} />

      {/* Reservation button — opens the clinic-specific external site in a
          new tab. We use the brand's secondary colour (ink-900 / black) with
          a yellow accent for the clinic label so it stays on-palette while
          standing out clearly against the page. */}
      {clinic?.reservation_url ? (
        <a
          href={clinic.reservation_url}
          target="_blank"
          rel="noopener noreferrer"
          className="group mb-5 flex items-center justify-between rounded-full bg-ink-900 text-white font-black tracking-widest py-4 px-5 shadow-soft hover:bg-ink-800 active:scale-[0.99] transition"
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent text-ink-900"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden
              >
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
            aria-hidden
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
        <div className="mb-5 rounded-full border border-dashed border-ink-200 text-ink-400 text-xs text-center py-3 px-5">
          {clinic
            ? "予約サイトURLが未設定です（院にお問い合わせください）"
            : "通院されている院が未設定です（院にお問い合わせください）"}
        </div>
      )}

      <section className="mb-5">
        {/*
          On the patient calendar every day routes through /me/log/[date]
          (including diagnosis-only days) so the patient can fill in the day
          record AND see the diagnosis link from the same screen.
        */}
        <HistoryCalendar
          diagnoses={diagnoses.map((d) => ({
            date: d.diagnosed_at,
            href: `/me/log/${d.diagnosed_at.slice(0, 10)}`,
          }))}
          logs={logs.map((l) => ({
            date: `${l.log_date}T00:00:00`,
            href: `/me/log/${l.log_date}`,
          }))}
          visits={visits.map((v) => ({
            date: `${v.visit_date}T00:00:00`,
            // Patients land on the day record when tapping a visit-only day
            // since there's no dedicated "visit detail" view for them.
            href: `/me/log/${v.visit_date}`,
          }))}
          emptyDayBasePath="/me/log"
        />
      </section>

      <section className="mb-5 space-y-3">
        <SymptomHeatmap
          logs={logs}
          hrefForDate={(ymd) => `/me/log/${ymd}`}
        />
        <SymptomRanking logs={logs} days={14} />
      </section>

      {diagnoses.length >= 2 && (
        <section className="mb-5 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
          <h2 className="text-xs tracking-widest text-ink-400 mb-3">
            体質スコアの推移
          </h2>
          <div className="overflow-x-auto -mx-1 px-1">
            <TrendChart rows={diagnoses} />
          </div>
        </section>
      )}

      {diagnoses.length === 0 && logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
          まだ記録がありません。
          <br />
          上のボタンから今日の体調を記録してみましょう。
        </div>
      ) : (
        diagnoses.length > 0 && (
          <section>
            <h2 className="text-xs tracking-widest text-ink-400 mb-2">
              最近の診断結果
            </h2>
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
        )
      )}
    </main>
  );
}
