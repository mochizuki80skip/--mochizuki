import RadarChart from "./RadarChart";
import { contentForType } from "@/lib/content";
import { AXIS_LABEL } from "@/lib/types";
import type { DiagnosisRow, Patient } from "@/lib/types";

type Props = {
  row: DiagnosisRow;
  patient?: Patient;
  /** Optional previous diagnosis to overlay for comparison */
  compare?: DiagnosisRow | null;
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const AXIS_ORDER = ["nerve", "circ", "metab"] as const;

export default function PrintableDiagnosis({ row, patient, compare }: Props) {
  const c = contentForType(row.type_key);

  return (
    <article className="mx-auto max-w-2xl px-6 py-8 bg-white print:p-0 print:max-w-full">
      {/* Header */}
      <header className="flex items-center justify-between border-b-2 border-ink-900 pb-3 mb-5">
        <div>
          <div className="text-[10px] tracking-[0.3em] text-ink-400">
            KARADA COMPASS
          </div>
          <div className="text-sm font-black text-ink-900 mt-0.5">
            体質診断レポート
          </div>
        </div>
        <div className="text-right text-xs text-ink-700 tabular-nums">
          {formatDate(row.diagnosed_at)}
        </div>
      </header>

      {/* Patient info */}
      {patient && (
        <section className="mb-5 grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-ink-400 tracking-widest">カルテ番号</div>
            <div className="font-bold text-ink-900 tabular-nums mt-0.5">
              {patient.chart_number}
            </div>
          </div>
          <div className="col-span-2">
            <div className="text-ink-400 tracking-widest">お名前</div>
            <div className="font-bold text-ink-900 mt-0.5">{patient.name}</div>
          </div>
        </section>
      )}

      {/* Type */}
      <section className="mb-5 rounded-xl border-2 border-accent bg-accent-50 px-5 py-4 print:bg-white">
        <div className="text-[11px] tracking-widest text-accent-600 font-bold mb-1">
          診断結果
        </div>
        <h1 className="text-xl font-black text-ink-900">{c.name}</h1>
        <p className="text-xs text-ink-700 mt-1.5 leading-relaxed">
          {c.tagline}
        </p>
      </section>

      {/* Radar + scores */}
      <section className="mb-5 grid grid-cols-[auto_1fr] gap-5 items-center">
        <div>
          <RadarChart
            axes={row.scores}
            size={220}
            compare={compare?.scores}
            compareLabel={
              compare ? `前回 (${formatDate(compare.diagnosed_at)})` : undefined
            }
          />
        </div>
        <div className="space-y-2">
          {AXIS_ORDER.map((k) => {
            const v = row.scores[k];
            const prev = compare?.scores[k];
            const delta = prev ? v.normalized - prev.normalized : null;
            return (
              <div
                key={k}
                className="rounded-lg border border-ink-200 px-3 py-2"
              >
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-bold text-ink-900">
                    {AXIS_LABEL[k].ja}
                  </span>
                  <span className="text-ink-400">
                    ({AXIS_LABEL[k].role})
                  </span>
                  <span className="ml-auto tabular-nums font-black text-ink-900">
                    {v.normalized}
                  </span>
                  {delta != null && (
                    <span
                      className={[
                        "text-[10px] tabular-nums font-bold",
                        delta < 0
                          ? "text-emerald-600"
                          : delta > 0
                          ? "text-rose-600"
                          : "text-ink-400",
                      ].join(" ")}
                    >
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Features + Advice in 2 columns */}
      <section className="grid grid-cols-2 gap-4 text-[11px] text-ink-700 leading-relaxed">
        <div>
          <h2 className="text-[10px] tracking-widest text-ink-400 font-bold mb-1.5">
            身体の状態
          </h2>
          <ul className="space-y-1 mb-4">
            {c.features.body.slice(0, 3).map((it, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-accent-600">●</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>

          <h2 className="text-[10px] tracking-widest text-ink-400 font-bold mb-1.5">
            起きやすい症状
          </h2>
          <ul className="space-y-1">
            {c.features.symptoms.slice(0, 3).map((it, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-accent-600">●</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-[10px] tracking-widest text-ink-400 font-bold mb-1.5">
            今日からできる改善
          </h2>
          <div className="space-y-2">
            {(
              [
                ["🌙 睡眠", c.advice.sleep],
                ["🥣 食事", c.advice.food],
                ["🚶 運動", c.advice.exercise],
                ["🌿 ストレス", c.advice.stress],
              ] as const
            ).map(([label, items]) => (
              <div key={label}>
                <div className="font-bold text-ink-900 mb-0.5">{label}</div>
                <ul className="space-y-0.5 ml-3">
                  {items.slice(0, 2).map((it, i) => (
                    <li key={i}>・{it}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-6 pt-3 border-t border-ink-200 text-[9px] text-ink-400 leading-relaxed">
        ※
        本レポートは体質傾向の参考情報であり、医療行為の代替ではありません。
        体調に著しい異常がある場合は医療機関を受診してください。
      </footer>
    </article>
  );
}
