import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePatient } from "@/lib/guards";
import {
  getDailyLog,
  listDiagnosesForPatient,
} from "@/lib/db";
import PatientHeader from "../../PatientHeader";
import LogForm from "./LogForm";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${wd})`;
}

export default async function PatientLogPage({
  params,
}: {
  params: { date: string };
}) {
  if (!DATE_RE.test(params.date)) notFound();

  const patient = await requirePatient();

  const [log, diagnoses] = await Promise.all([
    getDailyLog(patient.id, params.date),
    listDiagnosesForPatient(patient.id),
  ]);

  // If a diagnosis exists on the same day, surface a link so the patient can
  // review it without leaving the day record context.
  const sameDayDiagnosis = diagnoses.find(
    (d) => d.diagnosed_at.slice(0, 10) === params.date,
  );

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isFuture = params.date > todayKey;

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12 fade-up">
      <PatientHeader />

      <div className="mb-3">
        <Link
          href="/me/dashboard"
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← マイページに戻る
        </Link>
      </div>

      <h1 className="text-[22px] font-black text-ink-900 mb-1">
        {formatDate(params.date)} の記録
      </h1>
      <p className="text-xs text-ink-500 mb-6">
        その日の気分・症状・ひとことを残せます。後から編集も可能です。
      </p>

      {sameDayDiagnosis && (
        <Link
          href={`/me/diagnoses/${sameDayDiagnosis.id}`}
          className="mb-5 flex items-center justify-between rounded-2xl border border-accent bg-accent-50 px-4 py-3 shadow-soft hover:bg-accent-100 transition"
        >
          <div>
            <div className="text-[10px] tracking-widest text-accent-600 font-bold mb-0.5">
              この日の体質診断
            </div>
            <div className="text-sm font-bold text-ink-900">
              診断結果を見る
            </div>
          </div>
          <span className="text-ink-400 text-xl leading-none">›</span>
        </Link>
      )}

      {isFuture ? (
        <div className="rounded-2xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
          未来の日付は記録できません。
        </div>
      ) : (
        <LogForm date={params.date} initial={log} />
      )}
    </main>
  );
}
