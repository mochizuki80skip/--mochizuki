import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessPatient, requireAdmin } from "@/lib/guards";
import {
  getChartById,
  getPatientById,
  listChartsForPatient,
  listCommentsForChart,
} from "@/lib/db";
import AdminHeader from "../../../../AdminHeader";
import ChartEditClient from "@/components/chart/ChartEditClient";
import ChartViewer from "@/components/chart/ChartViewer";
import CommentThread from "@/components/chart/CommentThread";

export const dynamic = "force-dynamic";

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default async function ChartDetailPage({
  params,
}: {
  params: { id: string; chartId: string };
}) {
  const ctx = requireAdmin();
  const patient = await getPatientById(params.id);
  if (!patient) notFound();
  if (!canAccessPatient(patient, ctx)) redirect("/admin/forbidden");

  const chart = await getChartById(params.chartId);
  if (!chart || chart.patient_id !== patient.id) notFound();

  const [comments, allCharts] = await Promise.all([
    listCommentsForChart(chart.id),
    listChartsForPatient(patient.id),
  ]);

  // 直前のカルテ (このカルテより古いもののうち最新 1 件)
  const olderCharts = allCharts
    .filter(
      (c) =>
        c.id !== chart.id &&
        new Date(c.created_at).getTime() < new Date(chart.created_at).getTime(),
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  const previous = olderCharts[0] || null;

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
          {formatDateLong(chart.created_at)} のカルテ
        </h1>
        <p className="text-xs text-ink-500 mt-1">
          タップでマーカーを追加 / 長押しで削除できます
        </p>
      </header>

      {/* Previous chart preview */}
      {previous && (
        <section className="rounded-2xl border border-ink-100 bg-white p-3 shadow-soft mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs tracking-widest text-ink-400 font-bold">
              📋 前回のカルテ ({formatDateLong(previous.created_at)})
            </h2>
            <Link
              href={`/admin/patients/${patient.id}/charts/${previous.id}`}
              className="text-[11px] text-ink-500 hover:text-ink-900 underline"
            >
              全画面で開く
            </Link>
          </div>
          <ChartViewer
            markers={previous.markers}
            freeNote={previous.free_note}
            compact
          />
        </section>
      )}

      {/* Edit (current chart) */}
      <section className="mb-4">
        <ChartEditClient
          visitId={chart.visit_id}
          patientId={patient.id}
          initialMarkers={chart.markers}
          initialFreeNote={chart.free_note ?? ""}
          redirectTo={`/admin/patients/${patient.id}/charts/${chart.id}`}
        />
      </section>

      {/* Comment thread */}
      <section className="mb-4">
        <CommentThread
          chartId={chart.id}
          initialComments={comments}
          currentRole={ctx.role}
        />
      </section>
    </main>
  );
}
