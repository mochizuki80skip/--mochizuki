import {
  AXIS_LABEL,
  BENSHO_LABEL,
  type TreatmentPlan,
} from "@/lib/types";

type Props = {
  plan: TreatmentPlan;
};

export default function TreatmentPlanCard({ plan }: Props) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        <h2 className="text-xs tracking-widest text-ink-400 mb-3">
          推奨治療順位（大分類スコア降順）
        </h2>
        <ol className="space-y-3">
          {plan.priority.map((entry, i) => (
            <li
              key={`${entry.axis}-${entry.bensho}`}
              className="rounded-xl border border-ink-100 bg-ink-50/60 p-3"
            >
              <div className="flex items-baseline gap-2 mb-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent text-ink-900 font-black text-xs tabular-nums">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-ink-900">
                    {AXIS_LABEL[entry.axis].ja}
                    <span className="ml-1.5 text-xs text-ink-500">
                      / {BENSHO_LABEL[entry.bensho].ja}
                    </span>
                  </div>
                  <div className="text-[11px] text-ink-500">
                    治法 : <span className="font-bold text-ink-900">{entry.chiho}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] tracking-widest text-ink-400">
                    大分類スコア
                  </div>
                  <div className="text-sm font-black text-ink-900 tabular-nums">
                    {entry.axisScore}
                    <span className="text-[10px] text-ink-400">/18</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {entry.points.map((pt) => (
                  <span
                    key={pt}
                    className="inline-flex items-center rounded-full border border-accent-200 bg-accent-50 px-2.5 py-1 text-xs font-bold text-ink-900"
                  >
                    {pt}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        <h2 className="text-xs tracking-widest text-ink-400 mb-3">
          回数別の進め方（仮文章）
        </h2>
        <ol className="space-y-2.5">
          {(
            [
              ["1回目", plan.sessions.first],
              ["2回目", plan.sessions.second],
              ["3回目", plan.sessions.third],
            ] as const
          ).map(([label, text]) => (
            <li
              key={label}
              className="rounded-xl border border-ink-100 bg-white p-3"
            >
              <div className="text-[11px] tracking-widest text-accent-600 font-bold mb-1">
                {label}
              </div>
              <p className="text-sm text-ink-800 leading-relaxed">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
