"use client";
import { AXIS_LABEL, type AxisKey, type AxisResult } from "@/lib/types";

type Props = {
  axes: Record<AxisKey, AxisResult>;
  size?: number;
  /** Optional previous diagnosis to overlay as a comparison ghost */
  compare?: Record<AxisKey, AxisResult>;
  /** Label shown next to the comparison shape */
  compareLabel?: string;
};

const ORDER: AxisKey[] = ["nerve", "circ", "metab"];
// angles in degrees, math convention (0 = right, CCW positive)
const ANGLES_DEG: Record<AxisKey, number> = {
  nerve: 90,   // top
  circ:  210,  // bottom-left
  metab: 330,  // bottom-right
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

export default function RadarChart({
  axes,
  size = 280,
  compare,
  compareLabel,
}: Props) {
  const cx = size / 2;
  const cy = size / 2 + 8; // slight downward offset to fit labels above
  const maxR = size * 0.36;

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  const vertices = ORDER.map((k) => polar(cx, cy, maxR, ANGLES_DEG[k]));
  const valuePoints = ORDER.map((k) => {
    const t = Math.max(0, Math.min(1, axes[k].normalized / 100));
    return polar(cx, cy, maxR * t, ANGLES_DEG[k]);
  });
  const comparePoints = compare
    ? ORDER.map((k) => {
        const t = Math.max(0, Math.min(1, compare[k].normalized / 100));
        return polar(cx, cy, maxR * t, ANGLES_DEG[k]);
      })
    : null;

  const gridPolys = gridLevels.map((lv) =>
    ORDER.map((k) => polar(cx, cy, maxR * lv, ANGLES_DEG[k]))
      .map((p) => `${p.x},${p.y}`)
      .join(" ")
  );

  const valuePoly = valuePoints.map((p) => `${p.x},${p.y}`).join(" ");
  const comparePoly = comparePoints
    ? comparePoints.map((p) => `${p.x},${p.y}`).join(" ")
    : null;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="3軸レーダーチャート"
    >
      {/* Grid concentric triangles */}
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

      {/* Comparison polygon (rendered first so the current value sits on top) */}
      {comparePoly && (
        <polygon
          points={comparePoly}
          fill="rgba(15,17,21,0.05)"
          stroke="#9CA3AF"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
      )}
      {comparePoints &&
        comparePoints.map((p, i) => (
          <circle
            key={`c-${i}`}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="#9CA3AF"
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}

      {/* Value polygon */}
      <polygon
        points={valuePoly}
        fill="rgba(245,197,24,0.30)"
        stroke="#F5C518"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {valuePoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={5} fill="#F5C518" stroke="#fff" strokeWidth={2} />
      ))}

      {/* Comparison legend */}
      {compare && compareLabel && (
        <g>
          <rect
            x={8}
            y={size - 22}
            width={10}
            height={10}
            fill="rgba(15,17,21,0.05)"
            stroke="#9CA3AF"
            strokeWidth={1.5}
            strokeDasharray="2 1.5"
          />
          <text
            x={22}
            y={size - 13}
            className="fill-ink-500"
            fontSize={10}
          >
            {compareLabel}
          </text>
        </g>
      )}

      {/* Axis labels */}
      {ORDER.map((k) => {
        const v = polar(cx, cy, maxR + 22, ANGLES_DEG[k]);
        const value = axes[k].normalized;
        return (
          <g key={k}>
            <text
              x={v.x}
              y={v.y - 4}
              textAnchor="middle"
              className="fill-ink-900"
              fontSize={13}
              fontWeight={700}
            >
              {AXIS_LABEL[k].ja}
            </text>
            <text
              x={v.x}
              y={v.y + 12}
              textAnchor="middle"
              className="fill-ink-500"
              fontSize={11}
            >
              {value}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
