"use client";

import { useEffect, useRef, useState } from "react";
import BodySilhouette from "./BodySilhouette";
import MarkerIcon, { MARKER_META } from "./MarkerIcon";
import { expandAcupoints, type AcupointMode } from "@/lib/acupoints";
import { getPartRegion, type RegionShape } from "@/lib/body-regions";
import type {
  ChartMarker,
  ChartMarkerType,
  ChartView,
} from "@/lib/types";

type Props = {
  view: ChartView;
  showAcupoints: boolean;
  acupointMode: AcupointMode;
  markers: ChartMarker[];
  /** 編集モード OFF のときはタップしても追加しない */
  editable: boolean;
  /** タップで配置するマーカー種別 (鍼/円皮鍼/灸/手技 のみ意味あり) */
  selectedType: ChartMarkerType;
  onAddPoint: (m: { x: number; y: number; type: ChartMarkerType }) => void;
  onLongPressMarker: (id: string) => void;
};

const VIEWBOX_W = 100;
const VIEWBOX_H = 133;
const ZOOM_LEVELS = [1, 2, 3] as const;

export default function ChartCanvas({
  view,
  showAcupoints,
  acupointMode,
  markers,
  editable,
  selectedType,
  onAddPoint,
  onLongPressMarker,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  // ズーム状態 (1x / 2x / 3x) + パン (viewBox 内 0..VIEWBOX_W/H)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  // ドラッグ中のパン操作用
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    moved: boolean;
  } | null>(null);

  // ズーム後の viewBox
  const vbW = VIEWBOX_W / zoom;
  const vbH = VIEWBOX_H / zoom;
  const maxPanX = VIEWBOX_W - vbW;
  const maxPanY = VIEWBOX_H - vbH;
  const clampedPan = {
    x: Math.max(0, Math.min(maxPanX, pan.x)),
    y: Math.max(0, Math.min(maxPanY, pan.y)),
  };

  // ズームを変えた時にパンを範囲内に収める
  useEffect(() => {
    setPan((p) => ({
      x: Math.max(0, Math.min(VIEWBOX_W - VIEWBOX_W / zoom, p.x)),
      y: Math.max(0, Math.min(VIEWBOX_H - VIEWBOX_H / zoom, p.y)),
    }));
  }, [zoom]);

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

  function isPointMarkerType(t: ChartMarkerType): boolean {
    return !MARKER_META[t].needsPart;
  }

  function handleCanvasPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    // パン or タップを判定するため、開始位置を記録
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: clampedPan.x,
      startPanY: clampedPan.y,
      moved: false,
    };
    if (zoom > 1) {
      // ズーム中はドラッグでパン
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
  }

  function handleCanvasPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = dragRef.current;
    if (!d || zoom <= 1) return;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    // 5px 以上動いたらドラッグとみなす
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    d.moved = true;
    // 画面ピクセル → SVG 座標換算 (svg 全体の幅から比例計算)
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const sx = (dx / rect.width) * vbW;
    const sy = (dy / rect.height) * vbH;
    setPan({
      x: Math.max(0, Math.min(maxPanX, d.startPanX - sx)),
      y: Math.max(0, Math.min(maxPanY, d.startPanY - sy)),
    });
  }

  function handleCanvasPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const d = dragRef.current;
    dragRef.current = null;
    if (!editable) return;
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    // パンしていたらタップ扱いしない
    if (d?.moved) return;
    // 部位選択タイプはタップで追加できない (パレット側に「部位選択」UI がある)
    if (!isPointMarkerType(selectedType)) return;
    const pos = eventToSvgCoords(e);
    if (!pos) return;
    onAddPoint({ x: pos.x, y: pos.y, type: selectedType });
  }

  function handleMarkerPointerDown(id: string, e: React.PointerEvent) {
    if (!editable) return;
    e.stopPropagation();
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

  const acupoints = showAcupoints ? expandAcupoints(view, acupointMode) : [];
  const visibleMarkers = markers.filter((m) => m.view === view);
  // 部位選択マーカー (筋肉/骨格) — view: "front"/"back" それぞれにハイライトを描画
  const regionMarkers = markers.filter(
    (m) =>
      (m.type === "muscle" || m.type === "skeletal") &&
      typeof m.part === "string",
  );
  const pointMarkers = visibleMarkers.filter(
    (m) => m.type !== "muscle" && m.type !== "skeletal",
  );

  function renderShape(shape: RegionShape, color: string, key: string) {
    if (shape.view !== view) return null;
    const fill = `${color}55`; // ~33% opacity
    const stroke = color;
    const sw = 0.4;
    if (shape.kind === "ellipse") {
      return (
        <ellipse
          key={key}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    }
    if (shape.kind === "rect") {
      return (
        <rect
          key={key}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.rxRound ?? 0}
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    }
    return (
      <polygon
        key={key}
        points={shape.points.map((p) => `${p[0]},${p[1]}`).join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth={sw}
      />
    );
  }

  return (
    <div className="relative w-full">
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        {ZOOM_LEVELS.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoom(z)}
            className={[
              "w-9 h-9 rounded-full text-xs font-black tabular-nums shadow-soft transition border",
              zoom === z
                ? "bg-accent border-accent text-ink-900"
                : "bg-white border-ink-200 text-ink-700 hover:border-accent",
            ].join(" ")}
            aria-label={`${z}倍ズーム`}
          >
            {z}x
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`${clampedPan.x} ${clampedPan.y} ${vbW} ${vbH}`}
        className="w-full h-auto select-none touch-none bg-white"
        style={{
          aspectRatio: `${VIEWBOX_W} / ${VIEWBOX_H}`,
          cursor: zoom > 1 ? "grab" : editable ? "crosshair" : "default",
        }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
      >
        <BodySilhouette view={view} />

        {/* 部位選択マーカー (筋肉/骨格) — 半透明ハイライト */}
        {regionMarkers.map((m) => {
          const region = getPartRegion(
            m.type as "muscle" | "skeletal",
            m.part as string,
          );
          if (!region) return null;
          const color = MARKER_META[m.type].color;
          return (
            <g key={`region-${m.id}`}>
              {region.shapes.map((s, i) =>
                renderShape(s, color, `${m.id}-${i}`),
              )}
            </g>
          );
        })}

        {/* 経穴ドット & ラベル */}
        {acupoints.map((p) => {
          const r = acupointMode === "main" ? 0.7 : 0.5;
          const fontSize = acupointMode === "main" ? 1.5 : 1.0;
          return (
            <g key={p.key} style={{ pointerEvents: "none" }}>
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={p.isMain ? "#EC4899" : "#F472B6"}
                opacity={p.isMain ? 0.9 : 0.7}
              />
              {(acupointMode === "main" || zoom > 1) && (
                <text
                  x={p.x}
                  y={p.y - 1.2}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fill="#831843"
                  fontWeight={600}
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}

        {/* 点マーカー (鍼/円皮鍼/灸/手技) */}
        {pointMarkers.map((m) => (
          <g
            key={m.id}
            onPointerDown={(ev) => handleMarkerPointerDown(m.id, ev)}
            onPointerUp={(ev) => {
              ev.stopPropagation();
              clearLongPress();
            }}
            onPointerLeave={clearLongPress}
            style={{ cursor: editable ? "pointer" : "default" }}
          >
            <MarkerIcon type={m.type} cx={m.x} cy={m.y} />
          </g>
        ))}
      </svg>
    </div>
  );
}
