import { AXIS_LABEL, type AxisKey, type AxisResult } from "@/lib/types";
import { LEVEL_LABEL } from "@/lib/scoring";

type Props = { result: AxisResult };

const AXIS_TONE: Record<AxisKey, string> = {
  nerve: "from-accent-200 to-accent",
  circ:  "from-accent-200 to-accent",
  metab: "from-accent-200 to-accent",
};

export default function AxisBar({ result }: Props) {
  const label = AXIS_LABEL[result.axis];
  const lv = LEVEL_LABEL[result.level];
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-soft">
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <span className="text-base font-bold text-ink-900">{label.ja}</span>
          <span className="text-xs text-ink-500 ml-2">/ {label.role}</span>
        </div>
        <span className={`text-sm font-bold ${lv.tone}`}>{lv.ja}</span>
      </div>
      <div className="h-2 w-full bg-ink-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${AXIS_TONE[result.axis]}`}
          style={{ width: `${result.normalized}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-400">
        <span>良好</span>
        <span className="text-ink-700 tabular-nums">{result.normalized}</span>
        <span>不調</span>
      </div>
    </div>
  );
}
