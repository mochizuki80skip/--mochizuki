import Link from "next/link";
import { requirePatient } from "@/lib/guards";
import { listChartsForPatient } from "@/lib/db";
import PatientHeader from "../PatientHeader";
import { MARKER_META } from "@/components/chart/MarkerIcon";
import type { ChartMarkerType } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatDateLong(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export default async function MyChartListPage() {
  const patient = await requirePatient();
  const charts = await listChartsForPatient(patient.id);

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

      <header className="mb-4">
        <h1 className="text-[22px] font-black text-ink-900 leading-tight">
          🩺 施術カルテ
        </h1>
        <p className="text-xs text-ink-500 mt-1">
          院で受けた施術の記録です
        </p>
      </header>

      {charts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
          カルテはまだありません。
        </div>
      ) : (
        <ul className="space-y-2">
          {charts.map((c) => {
            const types = new Set<ChartMarkerType>(c.markers.map((m) => m.type));
            return (
              <li key={c.id}>
                <Link
                  href={`/me/charts/${c.id}`}
                  className="block rounded-xl border border-ink-100 bg-white px-4 py-3 shadow-soft hover:border-accent transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-[11px] tracking-widest text-ink-400 tabular-nums w-24 shrink-0">
                      {formatDateLong(c.created_at)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-ink-900">
                        マーカー {c.markers.length} 件
                      </div>
                      {types.size > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {Array.from(types)
                            .slice(0, 4)
                            .map((t) => (
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
