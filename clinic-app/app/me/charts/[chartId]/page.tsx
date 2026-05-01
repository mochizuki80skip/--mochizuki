import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePatient } from "@/lib/guards";
import { getChartById } from "@/lib/db";
import PatientHeader from "../../PatientHeader";
import ChartViewer from "@/components/chart/ChartViewer";

export const dynamic = "force-dynamic";

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default async function MyChartPage({
  params,
}: {
  params: { chartId: string };
}) {
  const patient = await requirePatient();
  const chart = await getChartById(params.chartId);
  if (!chart || chart.patient_id !== patient.id) notFound();

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12 fade-up">
      <PatientHeader />
      <div className="mb-3">
        <Link
          href="/me/dashboard"
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← マイページ
        </Link>
      </div>

      <header className="rounded-2xl border border-ink-100 bg-gradient-to-b from-accent-50 to-white p-5 shadow-soft mb-4">
        <div className="text-[11px] tracking-widest text-accent-600 font-bold mb-1">
          施術カルテ
        </div>
        <h1 className="text-[20px] font-black text-ink-900 leading-tight">
          {formatDateLong(chart.created_at)} の施術内容
        </h1>
      </header>

      <ChartViewer markers={chart.markers} freeNote={chart.free_note} />
    </main>
  );
}
