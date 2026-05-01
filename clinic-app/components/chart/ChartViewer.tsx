"use client";

import { useState } from "react";
import ChartCanvas from "./ChartCanvas";
import { MARKER_META } from "./MarkerIcon";
import type {
  ChartMarker,
  ChartView,
} from "@/lib/types";
import type { AcupointMode } from "@/lib/acupoints";

type Props = {
  markers: ChartMarker[];
  freeNote: string | null;
  defaultView?: ChartView;
  /** ビュー/設定切替を出さない (サムネイル表示時) */
  compact?: boolean;
};

export default function ChartViewer({
  markers,
  freeNote,
  defaultView = "front",
  compact,
}: Props) {
  const [view, setView] = useState<ChartView>(defaultView);
  const [showAcupoints, setShowAcupoints] = useState(false);
  const [acupointMode, setAcupointMode] = useState<AcupointMode>("main");

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {(["front", "back"] as const).map((v) => (
          <div
            key={v}
            className="rounded-xl border border-ink-100 bg-white p-1 shadow-soft"
          >
            <div className="text-[10px] tracking-widest text-ink-400 text-center pt-1">
              {v === "front" ? "正面" : "背面"}
            </div>
            <ChartCanvas
              view={v}
              showAcupoints={false}
              acupointMode="main"
              markers={markers}
              editable={false}
              selectedType="needle"
              onAddPoint={() => {}}
              onLongPressMarker={() => {}}
            />
          </div>
        ))}
        {freeNote && (
          <div className="col-span-2 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-700 leading-relaxed whitespace-pre-wrap">
            {freeNote}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 p-1 bg-ink-50 rounded-full">
        {(["front", "back"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={[
              "rounded-full py-2 text-sm font-bold transition",
              view === v
                ? "bg-white text-ink-900 shadow-soft"
                : "text-ink-500 hover:text-ink-700",
            ].join(" ")}
          >
            {v === "front" ? "正面" : "背面"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowAcupoints((v) => !v)}
          className={[
            "rounded-full px-3 py-1.5 text-xs font-bold border transition",
            showAcupoints
              ? "bg-pink-50 text-pink-700 border-pink-200"
              : "bg-white text-ink-400 border-ink-200",
          ].join(" ")}
        >
          ● 経穴 {showAcupoints ? "表示" : "非表示"}
        </button>
        {showAcupoints && (
          <div className="grid grid-cols-2 gap-1 p-1 bg-ink-50 rounded-full">
            {(["main", "full"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setAcupointMode(m)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-bold transition tabular-nums",
                  acupointMode === m
                    ? "bg-white text-ink-900 shadow-soft"
                    : "text-ink-500 hover:text-ink-700",
                ].join(" ")}
              >
                {m === "main" ? "主要 40" : "全 361"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-2 shadow-soft">
        <ChartCanvas
          view={view}
          showAcupoints={showAcupoints}
          acupointMode={acupointMode}
          markers={markers}
          editable={false}
          selectedType="needle"
          onAddPoint={() => {}}
          onLongPressMarker={() => {}}
        />
      </div>

      {/* Marker legend */}
      <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-soft">
        <div className="text-[11px] tracking-widest text-ink-400 font-bold mb-2">
          配置内容
        </div>
        <ul className="grid grid-cols-2 gap-1.5 text-xs">
          {markers.map((m) => {
            const meta = MARKER_META[m.type];
            return (
              <li key={m.id} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: meta.color }}
                />
                <span className="text-ink-700 truncate">
                  {meta.label}
                  {m.part ? ` / ${m.part}` : ""}
                </span>
              </li>
            );
          })}
          {markers.length === 0 && (
            <li className="col-span-2 text-ink-400 text-center py-2">
              マーカーはまだありません
            </li>
          )}
        </ul>
      </div>

      {freeNote && (
        <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-soft">
          <div className="text-[11px] tracking-widest text-ink-400 font-bold mb-1.5">
            施術メモ
          </div>
          <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-wrap">
            {freeNote}
          </p>
        </div>
      )}
    </div>
  );
}
