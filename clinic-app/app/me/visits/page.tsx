import Link from "next/link";
import { requirePatient } from "@/lib/guards";
import { listVisitsForPatient } from "@/lib/db";
import VisitsCalendar from "@/components/VisitsCalendar";
import PatientHeader from "../PatientHeader";

export const dynamic = "force-dynamic";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function PatientVisitsPage() {
  const patient = await requirePatient();
  const visits = await listVisitsForPatient(patient.id);

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
        来院記録を編集
      </h1>
      <p className="text-xs text-ink-500 mb-5 leading-relaxed">
        日付をタップして来院日の追加・削除ができます。複数選択可能。
        最後に「保存する」で反映されます。
      </p>

      <VisitsCalendar
        initialDates={visits.map((v) => v.visit_date)}
        apiBase="/api/me/visits"
        todayKey={todayKey()}
        doneHref="/me/dashboard"
      />
    </main>
  );
}
