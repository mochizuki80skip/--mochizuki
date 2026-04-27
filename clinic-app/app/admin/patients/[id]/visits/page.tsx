import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessPatient, requireAdmin } from "@/lib/guards";
import { getPatientById, listVisitsForPatient } from "@/lib/db";
import VisitsCalendar from "@/components/VisitsCalendar";
import AdminHeader from "../../../AdminHeader";

export const dynamic = "force-dynamic";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function StaffVisitsPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = requireAdmin();
  const patient = await getPatientById(params.id);
  if (!patient) notFound();
  if (!canAccessPatient(patient, ctx)) redirect("/admin/forbidden");
  const visits = await listVisitsForPatient(patient.id);

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12 fade-up">
      <AdminHeader role={ctx.role} />
      <div className="mb-3">
        <Link
          href={`/admin/patients/${patient.id}`}
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← {patient.chart_number} {patient.name}
        </Link>
      </div>

      <h1 className="text-[22px] font-black text-ink-900 mb-1">
        来院記録の編集
      </h1>
      <p className="text-xs text-ink-500 mb-5 leading-relaxed">
        来院日を複数まとめて追加・削除できます。最後に「保存する」で反映されます。
      </p>

      <VisitsCalendar
        initialDates={visits.map((v) => v.visit_date)}
        apiBase={`/api/admin/patients/${patient.id}/visits`}
        todayKey={todayKey()}
        doneHref={`/admin/patients/${patient.id}`}
      />
    </main>
  );
}
