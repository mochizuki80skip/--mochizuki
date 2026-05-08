import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePatient } from "@/lib/guards";
import { listDiagnosesForPatient } from "@/lib/db";
import { contentForType } from "@/lib/content";
import RadarChart from "@/components/RadarChart";
import AxisBar from "@/components/AxisBar";
import { AXIS_LABEL } from "@/lib/types";
import { AXIS_DESC } from "@/lib/content";
import PatientHeader from "../../PatientHeader";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default async function MyDiagnosisDetail({
  params,
}: {
  params: { diagId: string };
}) {
  const patient = await requirePatient();
  const all = await listDiagnosesForPatient(patient.id);
  const row = all.find((d) => d.id === params.diagId);
  if (!row) notFound();

  const sorted = [...all].sort(
    (a, b) =>
      new Date(a.diagnosed_at).getTime() -
      new Date(b.diagnosed_at).getTime(),
  );
  const idx = sorted.findIndex((d) => d.id === row.id);
  const prev = idx > 0 ? sorted[idx - 1] : null;

  const c = contentForType(row.type_key);
  const axisOrder = (["nerve", "circ", "metab"] as const).slice();

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12">
      <PatientHeader />
      <div className="mb-3 flex items-center gap-3">
        <Link
          href="/me/dashboard"
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← マイページに戻る
        </Link>
        <Link
          href={`/me/diagnoses/${row.id}/print`}
          className="ml-auto rounded-full border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-700 hover:border-accent hover:text-ink-900 transition"
        >
          印刷 / PDF
        </Link>
      </div>

      <section className="rounded-2xl border border-ink-100 bg-gradient-to-b from-accent-50 to-white p-5 shadow-soft mb-5 fade-up">
        <div className="text-[11px] tracking-widest text-accent-600 font-bold mb-1">
          {formatDateTime(row.diagnosed_at)}
        </div>
        <h1 className="text-[24px] font-black text-ink-900 leading-tight">
          {c.name}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">{c.tagline}</p>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft mb-5">
        <h2 className="text-xs tracking-widest text-ink-400 mb-2">
          体質スコア / 3軸
          {prev && (
            <span className="ml-1 normal-case tracking-normal text-ink-500">
              （前回 {formatDateShort(prev.diagnosed_at)} と比較）
            </span>
          )}
        </h2>
        <div className="flex justify-center">
          <RadarChart
            axes={row.scores}
            size={300}
            compare={prev?.scores}
            compareLabel={prev ? `前回 (${formatDateShort(prev.diagnosed_at)})` : undefined}
          />
        </div>
      </section>

      {prev && (
        <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft mb-5">
          <h2 className="text-xs tracking-widest text-ink-400 mb-3">
            前回からの変化
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {axisOrder.map((k) => {
              const cur = row.scores[k].normalized;
              const old = prev.scores[k].normalized;
              const delta = cur - old;
              const tone =
                delta > 0
                  ? "text-emerald-600"
                  : delta < 0
                  ? "text-rose-600"
                  : "text-ink-400";
              return (
                <div
                  key={k}
                  className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2.5 text-center"
                >
                  <div className="text-[10px] tracking-widest text-ink-400">
                    {AXIS_LABEL[k].ja}
                  </div>
                  <div className="text-lg font-black text-ink-900 tabular-nums">
                    {cur}
                  </div>
                  <div className={`text-[11px] tabular-nums font-bold ${tone}`}>
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-ink-400 text-center mt-2">
            数値が上がった軸（緑）は改善傾向です
          </p>
        </section>
      )}

      <section className="space-y-2.5 mb-5">
        {axisOrder.map((k) => (
          <AxisBar key={k} result={row.scores[k]} />
        ))}
        <details className="rounded-xl border border-ink-100 bg-ink-50 px-4 py-3 text-xs text-ink-500 leading-relaxed">
          <summary className="cursor-pointer font-bold text-ink-700">
            3軸の意味について
          </summary>
          <div className="mt-2 space-y-2">
            {axisOrder.map((k) => (
              <div key={k}>
                <span className="font-bold text-ink-900">
                  {AXIS_LABEL[k].ja}
                </span>
                <span className="text-ink-400 ml-1">({AXIS_LABEL[k].role})</span>
                <span className="block">{AXIS_DESC[k]}</span>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs tracking-widest text-ink-400">改善アドバイス</h2>
        {(
          [
            ["睡眠", c.advice.sleep],
            ["食事", c.advice.food],
            ["運動", c.advice.exercise],
            ["ストレス", c.advice.stress],
          ] as const
        ).map(([label, items]) => (
          <details
            key={label}
            className="rounded-xl border border-ink-100 bg-white p-4 shadow-soft"
          >
            <summary className="cursor-pointer font-bold text-ink-900 text-sm">
              {label}
            </summary>
            <ul className="mt-2 space-y-1.5">
              {items.map((it, i) => (
                <li
                  key={i}
                  className="text-sm text-ink-800 leading-relaxed flex gap-2"
                >
                  <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-accent" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
    </main>
  );
}
