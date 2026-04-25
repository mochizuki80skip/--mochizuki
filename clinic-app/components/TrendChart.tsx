"use client";
import { AXIS_LABEL, type AxisKey, type DiagnosisRow } from "@/lib/types";

const AXIS_ORDER: AxisKey[] = ["nerve", "circ", "metab"];
const COLORS: Record<AxisKey, string> = {
  nerve: "#F5C518",
  circ: "#3B82F6",
  metab: "#10B981",
};

type Props = {
  rows: DiagnosisRow[]; // expected: most recent first
  width?: number;
  height?: number;
};

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function TrendChart({ rows, width = 320, height = 200 }: Props) {
  // Plot oldest -> newest (chronological).
  const ordered = [...rows].sort(
    (a, b) =>
      new Date(a.diagnosed_at).getTime() - new Date(b.diagnosed_at).getTime(),
  );
  const n = ordered.length;
  if (n === 0) return null;

  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const xFor = (i: number) =>
    padL + (n === 1 ? innerW / 2 : (innerW * i) / (n - 1));
  const yFor = (v: number) =>
    padT + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div>
      <div className="flex items-center gap-3 mb-2 text-[11px]">
        {AXIS_ORDER.map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-ink-700">
            <span
              className="inline-block w-3 h-0.5 rounded"
              style={{ background: COLORS[k] }}
            />
            {AXIS_LABEL[k].ja}
          </span>
        ))}
      </div>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="3軸スコアの推移"
        className="block"
      >
        {/* Grid lines + Y labels */}
        {yTicks.map((t) => {
          const y = yFor(t);
          return (
            <g key={t}>
              <line
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke="#F1F2F4"
                strokeWidth={1}
              />
              <text
                x={padL - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-ink-400"
                fontSize={10}
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* X axis labels */}
        {ordered.map((r, i) => (
          <text
            key={r.id}
            x={xFor(i)}
            y={height - padB + 14}
            textAnchor="middle"
            className="fill-ink-400"
            fontSize={10}
          >
            {shortDate(r.diagnosed_at)}
          </text>
        ))}

        {/* Lines per axis */}
        {AXIS_ORDER.map((k) => {
          const path = ordered
            .map(
              (r, i) =>
                `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(r.scores[k].normalized)}`,
            )
            .join(" ");
          return (
            <g key={k}>
              <path
                d={path}
                fill="none"
                stroke={COLORS[k]}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {ordered.map((r, i) => (
                <circle
                  key={r.id}
                  cx={xFor(i)}
                  cy={yFor(r.scores[k].normalized)}
                  r={3}
                  fill={COLORS[k]}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          );
        })}
      </svg>
      <p className="text-[10px] text-ink-400 text-center mt-1">
        数値が大きいほど不調傾向。下方向への推移は改善を意味します。
      </p>
    </div>
  );
}
