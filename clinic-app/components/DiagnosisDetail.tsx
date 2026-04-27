import RadarChart from "./RadarChart";
import AxisBar from "./AxisBar";
import { contentForType, AXIS_DESC } from "@/lib/content";
import { AXIS_LABEL } from "@/lib/types";
import type { DiagnosisRow } from "@/lib/types";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function DiagnosisDetail({ row }: { row: DiagnosisRow }) {
  const content = contentForType(row.type_key);
  const axisOrder = (["nerve", "circ", "metab"] as const).slice();

  return (
    <div className="space-y-5 fade-up">
      <section className="rounded-2xl border border-ink-100 bg-gradient-to-b from-accent-50 to-white p-5 shadow-soft">
        <div className="text-[11px] tracking-widest text-accent-600 font-bold mb-1">
          {formatDateTime(row.diagnosed_at)}
        </div>
        <h1 className="text-[24px] font-black text-ink-900 leading-tight">
          {content.name}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">
          {content.tagline}
        </p>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        <h2 className="text-xs tracking-widest text-ink-400 mb-2">
          体質スコア / 3軸
        </h2>
        <div className="flex justify-center">
          <RadarChart axes={row.scores} size={300} />
        </div>
      </section>

      <section className="space-y-2.5">
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

      <section className="space-y-4">
        <Block title="特徴 / 身体の状態" items={content.features.body} />
        <Block title="起きやすい症状" items={content.features.symptoms} />
        <Block title="原因 / 生活習慣" items={content.causes.lifestyle} />
        <Block title="このまま放置すると" items={content.risks} tone="risk" />
      </section>

      <section className="space-y-4">
        <h2 className="text-xs tracking-widest text-ink-400">
          改善アドバイス
        </h2>
        <AdviceBlock title="睡眠" emoji="🌙" items={content.advice.sleep} />
        <AdviceBlock title="食事" emoji="🥣" items={content.advice.food} />
        <AdviceBlock title="運動" emoji="🚶" items={content.advice.exercise} />
        <AdviceBlock title="ストレス" emoji="🌿" items={content.advice.stress} />
      </section>
    </div>
  );
}

function Block({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone?: "risk";
}) {
  return (
    <div
      className={[
        "rounded-xl border p-4 shadow-soft",
        tone === "risk"
          ? "border-ng/30 bg-rose-50/50"
          : "border-ink-100 bg-white",
      ].join(" ")}
    >
      <div
        className={[
          "text-[11px] tracking-widest font-bold mb-2",
          tone === "risk" ? "text-ng" : "text-ink-400",
        ].join(" ")}
      >
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-ink-800 leading-relaxed flex gap-2">
            <span
              className={[
                "mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0",
                tone === "risk" ? "bg-ng" : "bg-accent",
              ].join(" ")}
            />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdviceBlock({
  title,
  emoji,
  items,
}: {
  title: string;
  emoji: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-lg leading-none" aria-hidden>
          {emoji}
        </span>
        <span className="font-bold text-ink-900">{title}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-ink-800 leading-relaxed flex gap-2">
            <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-accent" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
