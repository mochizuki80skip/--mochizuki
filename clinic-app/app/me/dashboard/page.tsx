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
  const [diagnoses, logs] = await Promise.all([
    listDiagnosesForPatient(patient.id),
    listDailyLogsForPatient(patient.id),
  ]);
  const clinic = getClinic(patient.clinic_id);

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

      {/* Reservation button — opens the clinic-specific external site in a
          new tab. We render it disabled with a helpful note when the patient
          isn't tied to a clinic yet, or when the URL hasn't been configured. */}
      {clinic?.reservation_url ? (
        <a
          href={clinic.reservation_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-5 flex items-center justify-between rounded-full border-2 border-ink-900 bg-white text-ink-900 font-black tracking-widest py-3 px-5 hover:bg-ink-50 transition"
        >
          <span className="text-[10px] tracking-widest text-ink-400">
            {clinic.name}
          </span>
          <span className="flex items-center gap-1">
            来院予約する
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                d="M14 4h6v6M20 4l-9 9M5 6h5M5 12h3M5 18h11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
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
