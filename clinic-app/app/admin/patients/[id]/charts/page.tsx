import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessPatient, requireAdmin } from "@/lib/guards";
import {
  getPatientById,
  listChartsForPatient,
  listVisitsForPatient,
} from "@/lib/db";
import AdminHeader from "../../../AdminHeader";
import { MARKER_META } from "@/components/chart/MarkerIcon";
import type { ChartMarkerType } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export default async function ChartListPage({
  params,
}: {
  params: { id: string };
}) {
  const ctx = requireAdmin();
  const patient = await getPatientById(params.id);
  if (!patient) notFound();
  if (!canAccessPatient(patient, ctx)) redirect("/admin/forbidden");

  const [charts, visits] = await Promise.all([
    listChartsForPatient(patient.id),
    listVisitsForPatient(patient.id),
  ]);
  const chartByVisit: Record<string, (typeof charts)[number]> = {};
  for (const c of charts) chartByVisit[c.visit_id] = c;

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-12 fade-up">
      <AdminHeader role={ctx.role} />
      <div className="mb-3 flex items-center gap-3">
        <Link
          href={`/admin/patients/${patient.id}`}
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← {patient.chart_number} {patient.name}
        </Link>
      </div>

      <header className="mb-4">
        <h1 className="text-[22px] font-black text-ink-900 leading-tight">
          鍼灸カルテ一覧
        </h1>
        <p className="text-xs text-ink-500 mt-1">
          来院ごとの施術カルテ。日付をタップで詳細表示・編集できます。
        </p>
      </header>

      {visits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
          来院記録がまだありません。
          <br />
          先にカレンダーから来院を記録してください。
        </div>
      ) : (
        <ul className="space-y-2">
          {visits.map((v) => {
            const chart = chartByVisit[v.id];
            const types = new Set<ChartMarkerType>(
              (chart?.markers || []).map((m) => m.type),
            );
            return (
              <li key={v.id}>
                <Link
                  href={
                    chart
                      ? `/admin/patients/${patient.id}/charts/${chart.id}`
                      : `/admin/patients/${patient.id}/charts/new?visit_id=${v.id}`
                  }
                  className="block rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-soft hover:border-accent transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-[11px] tracking-widest text-ink-400 tabular-nums w-32 shrink-0">
                      {formatDateLong(v.visit_date)}
                    </div>
                    <div className="flex-1 min-w-0">
                      {chart ? (
                        <>
                          <div className="text-sm font-bold text-ink-900">
                            カルテあり ({chart.markers.length} 件のマーカー)
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
                        </>
                      ) : (
                        <div className="text-sm text-ink-400">
                          カルテ未作成 — タップで作成
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
    </main>
  );
}
