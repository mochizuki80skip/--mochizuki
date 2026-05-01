"use client";

import { useRef, useState } from "react";
import BodySilhouette from "./BodySilhouette";
import MarkerIcon, { MARKER_META } from "./MarkerIcon";
import { expandAcupoints } from "@/lib/acupoints";
import type {
  ChartLayer,
  ChartMarker,
  ChartMarkerType,
  ChartView,
} from "@/lib/types";

type Props = {
  view: ChartView;
  layer: ChartLayer;
  showAcupoints: boolean;
  markers: ChartMarker[];
  /** 編集モード OFF の場合はタップで追加・削除しない */
  editable: boolean;
  /** タップで配置するマーカーの種別 (編集モード時) */
  selectedType: ChartMarkerType;
  onAdd: (m: { x: number; y: number; type: ChartMarkerType }) => void;
  onLongPressMarker: (id: string) => void;
};

/**
 * 体図の SVG キャンバス。
 *  - タップ → 選択中の種別マーカーを配置 (onAdd 経由で部位選択モーダル等を親が出す)
 *  - マーカー長押し → onLongPressMarker (削除確認等)
 */
export default function ChartCanvas({
  view,
  layer,
  showAcupoints,
  markers,
  editable,
  selectedType,
  onAdd,
  onLongPressMarker,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  // 長押し検出用タイマー
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  function eventToSvgCoords(e: React.PointerEvent<SVGSVGElement>): {
    x: number;
    y: number;
  } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function handleCanvasClick(e: React.PointerEvent<SVGSVGElement>) {
    if (!editable) return;
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    const pos = eventToSvgCoords(e);
    if (!pos) return;
    onAdd({ x: pos.x, y: pos.y, type: selectedType });
  }

  function handleMarkerPointerDown(id: string) {
    if (!editable) return;
    longPressFiredRef.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPressMarker(id);
    }, 500);
  }
  function clearLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  const acupoints = showAcupoints ? expandAcupoints(view) : [];
  const visibleMarkers = markers.filter((m) => m.view === view);

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox="0 0 100 105"
        className="w-full h-auto select-none touch-none"
        onPointerDown={(e) => {
          // canvas-level pointerdown captures position for hover indicator;
          // actual add happens on click (after long-press window).
          const pos = eventToSvgCoords(e);
          if (pos) setHoverPos(pos);
        }}
        onClick={(e) => {
          // SVG click event reuses pointer coords from the synthetic event.
          handleCanvasClick(e as unknown as React.PointerEvent<SVGSVGElement>);
        }}
      >
        <BodySilhouette view={view} layer={layer} />

        {/* 経穴ドット & ラベル */}
        {acupoints.map((p) => (
          <g key={p.key}>
            <circle cx={p.x} cy={p.y} r={0.7} fill="#EC4899" opacity={0.85} />
            <text
              x={p.x}
              y={p.y - 1.2}
              textAnchor="middle"
              fontSize={1.5}
              fill="#831843"
              fontWeight={600}
              style={{ pointerEvents: "none" }}
            >
              {p.label}
            </text>
          </g>
        ))}

        {/* マーカー */}
        {visibleMarkers.map((m) => (
          <g
            key={m.id}
            onPointerDown={(ev) => {
              ev.stopPropagation();
              handleMarkerPointerDown(m.id);
            }}
            onPointerUp={(ev) => {
              ev.stopPropagation();
              clearLongPress();
            }}
            onPointerLeave={clearLongPress}
            onClick={(ev) => ev.stopPropagation()}
            style={{ cursor: editable ? "pointer" : "default" }}
          >
            <MarkerIcon type={m.type} cx={m.x} cy={m.y} />
            {m.part && (
              <text
                x={m.x}
                y={m.y + 3.2}
                textAnchor="middle"
                fontSize={1.7}
                fill={MARKER_META[m.type].color}
                fontWeight={700}
              >
                {m.part}
              </text>
            )}
          </g>
        ))}

        {/* デバッグ用：直近タップ位置のゴースト (編集中のみ) */}
        {editable && hoverPos && (
          <circle
            cx={hoverPos.x}
            cy={hoverPos.y}
            r={1}
            fill="none"
            stroke="#0F1115"
            strokeOpacity={0.15}
            strokeWidth={0.3}
          />
        )}
      </svg>
    </div>
  );
}
