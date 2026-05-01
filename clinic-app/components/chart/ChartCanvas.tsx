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
  editable: boolean;
  selectedType: ChartMarkerType;
  onAddPoint: (m: { x: number; y: number; type: ChartMarkerType }) => void;
  onLongPressMarker: (id: string) => void;
};

const VIEWBOX_W = 100;
const VIEWBOX_H = 133.33;
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_BUTTONS = [1, 2, 3] as const;

type Pointer = { x: number; y: number };

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

  // ズーム + パン
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<Pointer>({ x: 0, y: 0 });

  // アクティブな pointer を ID で追跡 (pinch 用)
  const pointersRef = useRef<Map<number, Pointer>>(new Map());
  // ピンチズーム開始時の状態スナップショット
  const pinchStartRef = useRef<{
    distance: number;
    zoom: number;
    centerSvg: Pointer; // ピンチ中心の SVG 座標 (パンを保つため)
  } | null>(null);
  // 単指ドラッグ (パン) 状態
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    moved: boolean;
  } | null>(null);

  const vbW = VIEWBOX_W / zoom;
  const vbH = VIEWBOX_H / zoom;
  const maxPanX = VIEWBOX_W - vbW;
  const maxPanY = VIEWBOX_H - vbH;
  const clampedPan = {
    x: Math.max(0, Math.min(maxPanX, pan.x)),
    y: Math.max(0, Math.min(maxPanY, pan.y)),
  };

  useEffect(() => {
    setPan((p) => ({
      x: Math.max(0, Math.min(VIEWBOX_W - VIEWBOX_W / zoom, p.x)),
      y: Math.max(0, Math.min(VIEWBOX_H - VIEWBOX_H / zoom, p.y)),
    }));
  }, [zoom]);

  function clientToSvg(clientX: number, clientY: number): Pointer | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  function distance(a: Pointer, b: Pointer): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }
  function midpoint(a: Pointer, b: Pointer): Pointer {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function isPointMarkerType(t: ChartMarkerType): boolean {
    return !MARKER_META[t].needsPart;
  }

  function handleCanvasPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    (e.target as Element).setPointerCapture?.(e.pointerId);

    if (pointersRef.current.size === 2) {
      // ピンチズーム開始
      const pts = Array.from(pointersRef.current.values());
      const midClient = midpoint(pts[0], pts[1]);
      const midSvg = clientToSvg(midClient.x, midClient.y);
      pinchStartRef.current = {
        distance: distance(pts[0], pts[1]),
        zoom,
        centerSvg: midSvg ?? { x: VIEWBOX_W / 2, y: VIEWBOX_H / 2 },
      };
      // 単指ドラッグは中断
      dragRef.current = null;
    } else if (pointersRef.current.size === 1) {
      // 単指: ドラッグ開始 (ズーム中はパン、それ以外は後続のタップで配置)
      dragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: clampedPan.x,
        startPanY: clampedPan.y,
        moved: false,
      };
    }
  }

  function handleCanvasPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size >= 2 && pinchStartRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const newDist = distance(pts[0], pts[1]);
      const ratio = newDist / pinchStartRef.current.distance;
      const newZoom = Math.max(
        ZOOM_MIN,
        Math.min(ZOOM_MAX, pinchStartRef.current.zoom * ratio),
      );

      // ピンチ中心を画面中心に保つようにパンを再計算
      const center = pinchStartRef.current.centerSvg;
      const newVbW = VIEWBOX_W / newZoom;
      const newVbH = VIEWBOX_H / newZoom;
      const newPanX = center.x - newVbW / 2;
      const newPanY = center.y - newVbH / 2;
      setZoom(newZoom);
      setPan({
        x: Math.max(0, Math.min(VIEWBOX_W - newVbW, newPanX)),
        y: Math.max(0, Math.min(VIEWBOX_H - newVbH, newPanY)),
      });
      return;
    }

    // 単指: ズーム中はパン
    const d = dragRef.current;
    if (!d || zoom <= 1) return;
    const dx = e.clientX - d.startClientX;
    const dy = e.clientY - d.startClientY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    d.moved = true;
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
    const wasMultiTouch = pointersRef.current.size >= 2;
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchStartRef.current = null;
    }
    const d = dragRef.current;
    dragRef.current = null;

    // マルチタッチ後はタップ扱いしない (誤配置防止)
    if (wasMultiTouch) return;
    if (!editable) return;
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    if (d?.moved) return;
    if (!isPointMarkerType(selectedType)) return;
    const pos = clientToSvg(e.clientX, e.clientY);
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

  function setZoomCentered(z: number) {
    const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    const newVbW = VIEWBOX_W / newZoom;
    const newVbH = VIEWBOX_H / newZoom;
    // 現在の中心を保つ
    const cx = clampedPan.x + vbW / 2;
    const cy = clampedPan.y + vbH / 2;
    setZoom(newZoom);
    setPan({
      x: Math.max(0, Math.min(VIEWBOX_W - newVbW, cx - newVbW / 2)),
      y: Math.max(0, Math.min(VIEWBOX_H - newVbH, cy - newVbH / 2)),
    });
  }

  const acupoints = showAcupoints ? expandAcupoints(view, acupointMode) : [];
  const visibleMarkers = markers.filter((m) => m.view === view);
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
    const fill = `${color}55`;
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

  const isMultiTouch = pointersRef.current.size >= 2;
  const cursor = zoom > 1 ? "grab" : editable ? "crosshair" : "default";

  return (
    <div className="relative w-full">
      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
        {ZOOM_BUTTONS.map((z) => (
          <button
            key={z}
            type="button"
            onClick={() => setZoomCentered(z)}
            className={[
              "w-9 h-9 rounded-full text-xs font-black tabular-nums shadow-soft transition border",
              Math.abs(zoom - z) < 0.05
                ? "bg-accent border-accent text-ink-900"
                : "bg-white border-ink-200 text-ink-700 hover:border-accent",
            ].join(" ")}
            aria-label={`${z}倍ズーム`}
          >
            {z}x
          </button>
        ))}
      </div>
      {zoom > 1.05 && Math.abs(zoom - 1) > 0.05 && (
        <div className="absolute top-2 left-2 z-10 rounded-full bg-ink-900/80 text-white text-[10px] tabular-nums px-2 py-0.5">
          {zoom.toFixed(1)}x
        </div>
      )}

      <svg
        ref={svgRef}
        viewBox={`${clampedPan.x} ${clampedPan.y} ${vbW} ${vbH}`}
        className="w-full h-auto select-none touch-none bg-white"
        style={{
          aspectRatio: `${VIEWBOX_W} / ${VIEWBOX_H}`,
          cursor,
        }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={handleCanvasPointerUp}
      >
        <BodySilhouette view={view} />

        {/* 部位選択ハイライト */}
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
          const r = acupointMode === "main" ? 0.7 : 0.4;
          const showLabel =
            acupointMode === "main" || zoom > 1.5;
          const fontSize =
            acupointMode === "main" ? 1.5 / Math.max(1, zoom * 0.7) : 0.9;
          return (
            <g key={p.key} style={{ pointerEvents: "none" }}>
              <circle
                cx={p.x}
                cy={p.y}
                r={r}
                fill={p.isMain ? "#EC4899" : "#F472B6"}
                opacity={p.isMain ? 0.95 : 0.7}
              />
              {showLabel && (
                <text
                  x={p.x}
                  y={p.y - 1.0}
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

        {/* 点マーカー */}
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

      {isMultiTouch && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink-900/80 text-white text-[10px] px-3 py-1 z-10 pointer-events-none">
          ピンチでズーム中
        </div>
      )}
    </div>
  );
}
