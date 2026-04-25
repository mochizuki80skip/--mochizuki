import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/guards";
import { getPatientById, listDiagnosesForPatient } from "@/lib/db";
import { contentForType } from "@/lib/content";
import HistoryCalendar from "@/components/HistoryCalendar";
import AdminHeader from "../../AdminHeader";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function PatientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  requireAdmin();

  const patient = await getPatientById(params.id);
  if (!patient) notFound();

  const diagnoses = await listDiagnosesForPatient(patient.id);

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-12 fade-up">
      <AdminHeader />

      <div className="mb-3">
        <Link
          href="/admin"
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← 患者一覧
        </Link>
      </div>

      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-soft mb-5">
        <div className="text-[11px] tracking-widest text-accent-600 font-bold mb-1">
          {patient.chart_number}
        </div>
        <h1 className="text-[24px] font-black text-ink-900 leading-tight">
          {patient.name}
        </h1>
        {patient.furigana && (
          <div className="text-xs text-ink-500 mt-0.5">{patient.furigana}</div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
          <div>
            <div className="text-ink-400 tracking-widest mb-0.5">生年月日</div>
            <div className="text-ink-700 tabular-nums">
              {patient.birth_date || "—"}
            </div>
          </div>
          <div>
            <div className="text-ink-400 tracking-widest mb-0.5">登録日</div>
            <div className="text-ink-700 tabular-nums">
              {patient.created_at ? formatDateTime(patient.created_at).slice(0, 10) : "—"}
            </div>
          </div>
        </div>
        {patient.notes && (
          <div className="mt-4 rounded-lg bg-ink-50 px-3 py-2.5 text-xs text-ink-700 leading-relaxed whitespace-pre-wrap">
            {patient.notes}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link
            href={`/diagnose?patient=${patient.id}`}
            className="text-center rounded-full bg-accent text-ink-900 font-bold text-sm py-2.5 shadow-soft hover:bg-accent-400 transition"
          >
            ＋ 診断を実施
          </Link>
          <Link
            href={`/me?chart=${encodeURIComponent(patient.chart_number)}`}
            className="text-center rounded-full border border-ink-200 text-ink-700 font-bold text-sm py-2.5"
          >
            患者画面を確認
          </Link>
        </div>
      </section>

      <section className="mb-5">
        <h2 className="text-xs tracking-widest text-ink-400 mb-2">
          診断履歴 ({diagnoses.length})
        </h2>
        <HistoryCalendar
          entries={diagnoses.map((d) => ({
            date: d.diagnosed_at,
            href: `/admin/patients/${patient.id}/diagnoses/${d.id}`,
          }))}
        />
      </section>

      {diagnoses.length > 0 && (
        <section>
          <h2 className="text-xs tracking-widest text-ink-400 mb-2">
            一覧
          </h2>
          <ul className="space-y-2">
            {diagnoses.map((d) => {
              const c = contentForType(d.type_key);
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
                      <span className="text-ink-300 text-lg leading-none">›</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
