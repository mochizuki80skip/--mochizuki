import Link from "next/link";
import { requirePatient } from "@/lib/guards";
import { listDiagnosesForPatient } from "@/lib/db";
import { contentForType } from "@/lib/content";
import HistoryCalendar from "@/components/HistoryCalendar";
import TrendChart from "@/components/TrendChart";
import PatientHeader from "../PatientHeader";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function PatientDashboard() {
  const patient = await requirePatient();
  const diagnoses = await listDiagnosesForPatient(patient.id);

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
          診断日をタップすると、その日の結果を確認できます
        </p>
      </section>

      <Link
        href={`/diagnose?patient=${patient.id}`}
        className="block w-full text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition mb-5"
      >
        ＋ 今日の体質を診断する
      </Link>

      <section className="mb-5">
        <h2 className="text-xs tracking-widest text-ink-400 mb-2">
          診断履歴 ({diagnoses.length})
        </h2>
        <HistoryCalendar
          entries={diagnoses.map((d) => ({
            date: d.diagnosed_at,
            href: `/me/diagnoses/${d.id}`,
          }))}
        />
      </section>

      {diagnoses.length >= 2 && (
        <section className="mb-5 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
          <h2 className="text-xs tracking-widest text-ink-400 mb-3">
            3軸スコアの推移
          </h2>
          <div className="overflow-x-auto -mx-1 px-1">
            <TrendChart rows={diagnoses} />
          </div>
        </section>
      )}

      {diagnoses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
          まだ診断結果がありません。
          <br />
          上のボタンから最初の診断を始めましょう。
        </div>
      ) : (
        <section>
          <h2 className="text-xs tracking-widest text-ink-400 mb-2">
            最近の結果
          </h2>
          <ul className="space-y-2">
            {diagnoses.slice(0, 5).map((d) => {
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
      )}
    </main>
  );
}
