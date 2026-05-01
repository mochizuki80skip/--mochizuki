"use client";
import {
  BENSHO_LABEL,
  type BenshoKey,
  type BenshoResult,
} from "@/lib/types";

type Props = {
  bensho: Record<BenshoKey, BenshoResult>;
  size?: number;
};

// Order is clockwise from top, grouping each 大分類 together:
//   気虚 → 気滞 → 血虚 → 瘀血 → 陰虚 → 痰湿
// 60° between each spoke.
const ORDER: BenshoKey[] = [
  "kikyo", "kitai", "kekkyo", "oketsu", "inkyo", "tanshitsu",
];
// math convention: 0° = right, CCW positive
const ANGLES_DEG: Record<BenshoKey, number> = {
  kikyo:     90,   // top
  kitai:     30,   // upper-right
  kekkyo:    330,  // lower-right
  oketsu:    270,  // bottom
  inkyo:     210,  // lower-left
  tanshitsu: 150,  // upper-left
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

export default function BenshoRadarChart({ bensho, size = 300 }: Props) {
  const cx = size / 2;
  const cy = size / 2 + 8;
  const maxR = size * 0.34;

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const vertices = ORDER.map((k) => polar(cx, cy, maxR, ANGLES_DEG[k]));
  const valuePoints = ORDER.map((k) => {
    const t = Math.max(0, Math.min(1, bensho[k].normalized / 100));
    return polar(cx, cy, maxR * t, ANGLES_DEG[k]);
  });

  const gridPolys = gridLevels.map((lv) =>
    ORDER.map((k) => polar(cx, cy, maxR * lv, ANGLES_DEG[k]))
      .map((p) => `${p.x},${p.y}`)
      .join(" "),
  );

  const valuePoly = valuePoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="6軸 弁証レーダーチャート"
    >
      {/* Grid concentric hexagons */}
      {gridPolys.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill={i === gridPolys.length - 1 ? "#FAFAFA" : "none"}
          stroke="#E5E7EB"
          strokeWidth={1}
        />
      ))}

      {/* Axis spokes */}
      {vertices.map((v, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={v.x}
          y2={v.y}
          stroke="#E5E7EB"
          strokeWidth={1}
        />
      ))}

      {/* Value polygon — high = strong tendency (staff convention) */}
      <polygon
        points={valuePoly}
        fill="rgba(245,197,24,0.30)"
        stroke="#F5C518"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {valuePoints.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill="#F5C518"
          stroke="#fff"
          strokeWidth={2}
        />
      ))}

      {/* Axis labels */}
      {ORDER.map((k) => {
        const v = polar(cx, cy, maxR + 22, ANGLES_DEG[k]);
        const value = bensho[k].normalized;
        return (
          <g key={k}>
            <text
              x={v.x}
              y={v.y - 4}
              textAnchor="middle"
              className="fill-ink-900"
              fontSize={12}
              fontWeight={700}
            >
              {BENSHO_LABEL[k].ja}
            </text>
            <text
              x={v.x}
              y={v.y + 11}
              textAnchor="middle"
              className="fill-ink-500"
              fontSize={10}
            >
              {value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
