import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessPatient, requireAdmin } from "@/lib/guards";
import {
  getChartByVisit,
  getPatientById,
  listChartsForPatient,
  listVisitsForPatient,
} from "@/lib/db";
import AdminHeader from "../../../../AdminHeader";
import ChartEditClient from "@/components/chart/ChartEditClient";
import ChartViewer from "@/components/chart/ChartViewer";

export const dynamic = "force-dynamic";

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default async function NewChartPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { visit_id?: string };
}) {
  const ctx = requireAdmin();
  const patient = await getPatientById(params.id);
  if (!patient) notFound();
  if (!canAccessPatient(patient, ctx)) redirect("/admin/forbidden");

  const visitId = searchParams.visit_id;
  if (!visitId) redirect(`/admin/patients/${patient.id}/charts`);

  const visits = await listVisitsForPatient(patient.id);
  const visit = visits.find((v) => v.id === visitId);
  if (!visit) notFound();

  // すでに同じ visit_id のカルテがあればそちらにリダイレクト (重複作成防止)
  const existing = await getChartByVisit(visit.id);
  if (existing) {
    redirect(`/admin/patients/${patient.id}/charts/${existing.id}`);
  }

  // 直前のカルテ (前回テンプレートとして表示)
  const allCharts = await listChartsForPatient(patient.id);
  const previous = allCharts[0] || null; // listChartsForPatient is desc, so [0] is most recent

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-12 fade-up">
      <AdminHeader role={ctx.role} />
      <div className="mb-3 flex items-center gap-3">
        <Link
          href={`/admin/patients/${patient.id}/charts`}
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← カルテ一覧
        </Link>
      </div>

      <header className="rounded-2xl border border-ink-100 bg-gradient-to-b from-accent-50 to-white p-5 shadow-soft mb-4">
        <div className="text-[11px] tracking-widest text-accent-600 font-bold mb-1">
          {patient.chart_number}・{patient.name}
        </div>
        <h1 className="text-[22px] font-black text-ink-900 leading-tight">
          {formatDateLong(visit.visit_date)} のカルテ作成
        </h1>
        <p className="text-xs text-ink-500 mt-1">
          タップでマーカーを追加 / 長押しで削除できます
        </p>
      </header>

      {previous && (
        <section className="rounded-2xl border border-ink-100 bg-white p-3 shadow-soft mb-4">
          <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-2">
            前回のカルテ ({formatDateLong(previous.created_at)})
          </h2>
          <ChartViewer
            markers={previous.markers}
            freeNote={previous.free_note}
            compact
          />
        </section>
      )}

      <ChartEditClient
        visitId={visit.id}
        patientId={patient.id}
        initialMarkers={[]}
        initialFreeNote=""
        redirectTo={`/admin/patients/${patient.id}/charts/__id__`}
      />
    </main>
  );
}
