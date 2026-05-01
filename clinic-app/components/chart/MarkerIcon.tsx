import type { ChartMarkerType } from "@/lib/types";

export const MARKER_META: Record<
  ChartMarkerType,
  { label: string; color: string; needsPart: boolean }
> = {
  needle:   { label: "鍼",       color: "#EF4444", needsPart: false },
  intra:    { label: "円皮鍼",   color: "#3B82F6", needsPart: false },
  moxa:     { label: "灸",       color: "#A855F7", needsPart: false },
  manual:   { label: "手技",     color: "#10B981", needsPart: false },
  muscle:   { label: "筋肉調整", color: "#F59E0B", needsPart: true  },
  skeletal: { label: "骨格矯正", color: "#6B7280", needsPart: true  },
};

type Props = {
  type: ChartMarkerType;
  /** SVGの中心座標 */
  cx: number;
  cy: number;
  /** SVG内サイズ単位 (アイコンの大きさ) */
  size?: number;
};

/**
 * カルテ上のマーカーをSVGで描画。
 * 各 type で形状を出し分け。
 */
export default function MarkerIcon({ type, cx, cy, size = 3.2 }: Props) {
  const m = MARKER_META[type];
  const c = m.color;
  const r = size / 2;

  switch (type) {
    case "needle":
      // 赤い針 (短い線 + 先端)
      return (
        <g>
          <line
            x1={cx - r}
            y1={cy - r}
            x2={cx + r}
            y2={cy + r}
            stroke={c}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
          <circle cx={cx + r} cy={cy + r} r={0.7} fill={c} />
        </g>
      );
    case "intra":
      // 青い丸
      return (
        <circle
          cx={cx}
          cy={cy}
          r={r * 0.8}
          fill={c}
          stroke="#fff"
          strokeWidth={0.5}
        />
      );
    case "moxa":
      // 紫四角
      return (
        <rect
          x={cx - r * 0.85}
          y={cy - r * 0.85}
          width={r * 1.7}
          height={r * 1.7}
          fill={c}
          stroke="#fff"
          strokeWidth={0.5}
          rx={0.3}
        />
      );
    case "manual":
      // 緑の手アイコン (簡易)
      return (
        <g transform={`translate(${cx - r}, ${cy - r})`}>
          <rect width={size} height={size} fill={c} rx={0.6} stroke="#fff" strokeWidth={0.4} />
          <text
            x={size / 2}
            y={size * 0.75}
            textAnchor="middle"
            fontSize={size * 0.7}
            fill="#fff"
            fontWeight={700}
          >
            手
          </text>
        </g>
      );
    case "muscle":
      // オレンジバンド (横長楕円)
      return (
        <g>
          <ellipse
            cx={cx}
            cy={cy}
            rx={r * 1.3}
            ry={r * 0.7}
            fill={c}
            stroke="#fff"
            strokeWidth={0.4}
          />
          <text
            x={cx}
            y={cy + r * 0.4}
            textAnchor="middle"
            fontSize={r * 1.0}
            fill="#fff"
            fontWeight={700}
          >
            筋
          </text>
        </g>
      );
    case "skeletal":
      // グレーひし形
      return (
        <g>
          <polygon
            points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
            fill={c}
            stroke="#fff"
            strokeWidth={0.4}
          />
          <text
            x={cx}
            y={cy + r * 0.4}
            textAnchor="middle"
            fontSize={r * 1.0}
            fill="#fff"
            fontWeight={700}
          >
            骨
          </text>
        </g>
      );
  }
}
