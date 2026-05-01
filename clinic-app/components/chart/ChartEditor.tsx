"use client";

import { useState } from "react";
import ChartCanvas from "./ChartCanvas";
import { MARKER_META } from "./MarkerIcon";
import { MUSCLE_PARTS, SKELETAL_PARTS } from "@/lib/chart-parts";
import type {
  ChartLayer,
  ChartMarker,
  ChartMarkerType,
  ChartView,
} from "@/lib/types";

const ALL_TYPES: ChartMarkerType[] = [
  "needle",
  "intra",
  "moxa",
  "manual",
  "muscle",
  "skeletal",
];

type Props = {
  initialMarkers: ChartMarker[];
  initialFreeNote: string;
  /** 編集が確定した時に親が呼び出される。保存処理は親が行う想定 */
  onSave: (
    markers: ChartMarker[],
    freeNote: string,
  ) => Promise<void> | void;
  /** 保存中かどうか — ボタン disabled 用 */
  saving?: boolean;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ChartEditor({
  initialMarkers,
  initialFreeNote,
  onSave,
  saving,
}: Props) {
  const [view, setView] = useState<ChartView>("front");
  const [layer, setLayer] = useState<ChartLayer>("skeleton");
  const [showAcupoints, setShowAcupoints] = useState(true);
  const [selectedType, setSelectedType] =
    useState<ChartMarkerType>("needle");
  const [markers, setMarkers] = useState<ChartMarker[]>(initialMarkers);
  const [freeNote, setFreeNote] = useState(initialFreeNote);
  // 部位選択モーダル制御 (筋肉調整 / 骨格矯正 のとき)
  const [pendingPart, setPendingPart] = useState<{
    x: number;
    y: number;
    type: "muscle" | "skeletal";
  } | null>(null);

  function addMarker(args: { x: number; y: number; type: ChartMarkerType }) {
    const meta = MARKER_META[args.type];
    if (meta.needsPart) {
      // 部位選択モーダルを開いて、確定後に追加
      setPendingPart({ x: args.x, y: args.y, type: args.type as "muscle" | "skeletal" });
      return;
    }
    setMarkers((prev) => [
      ...prev,
      {
        id: uid(),
        view,
        x: args.x,
        y: args.y,
        type: args.type,
      },
    ]);
  }

  function confirmPart(part: string) {
    if (!pendingPart) return;
    setMarkers((prev) => [
      ...prev,
      {
        id: uid(),
        view,
        x: pendingPart.x,
        y: pendingPart.y,
        type: pendingPart.type,
        part,
      },
    ]);
    setPendingPart(null);
  }

  function removeMarker(id: string) {
    if (!confirm("このマーカーを削除しますか？")) return;
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }

  const visibleCount = markers.filter((m) => m.view === view).length;

  return (
    <div className="space-y-3">
      {/* View tabs (正面/背面) */}
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

      {/* Layer + acupoint toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="grid grid-cols-2 gap-1 p-1 bg-ink-50 rounded-full">
          {(["skeleton", "muscle"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLayer(l)}
              className={[
                "rounded-full px-3 py-1 text-xs font-bold transition",
                layer === l
                  ? "bg-white text-ink-900 shadow-soft"
                  : "text-ink-500 hover:text-ink-700",
              ].join(" ")}
            >
              {l === "skeleton" ? "骨格" : "筋肉"}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAcupoints((v) => !v)}
          className={[
            "rounded-full px-3 py-1.5 text-xs font-bold border transition",
            showAcupoints
              ? "bg-pink-50 text-pink-700 border-pink-200"
              : "bg-white text-ink-400 border-ink-200",
          ].join(" ")}
          aria-pressed={showAcupoints}
        >
          ● 経穴 {showAcupoints ? "表示" : "非表示"}
        </button>
        <span className="ml-auto text-[10px] tracking-widest text-ink-400">
          {view === "front" ? "正面" : "背面"} : {visibleCount}件
        </span>
      </div>

      {/* Body canvas */}
      <div className="rounded-2xl border border-ink-100 bg-white p-2 shadow-soft">
        <ChartCanvas
          view={view}
          layer={layer}
          showAcupoints={showAcupoints}
          markers={markers}
          editable={true}
          selectedType={selectedType}
          onAdd={addMarker}
          onLongPressMarker={removeMarker}
        />
        <p className="text-[10px] text-ink-400 text-center mt-1">
          タップで追加 / マーカー長押しで削除
        </p>
      </div>

      {/* Marker palette */}
      <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-soft">
        <div className="text-[11px] tracking-widest text-ink-400 font-bold mb-2">
          配置するマーカー
        </div>
        <div className="grid grid-cols-3 gap-2">
          {ALL_TYPES.map((t) => {
            const meta = MARKER_META[t];
            const selected = selectedType === t;
            return (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={[
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-bold transition",
                  selected
                    ? "border-accent bg-accent-50 text-ink-900"
                    : "border-ink-100 bg-white text-ink-700 hover:border-ink-200",
                ].join(" ")}
                aria-pressed={selected}
              >
                <span
                  aria-hidden
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ background: meta.color }}
                />
                <span className="truncate">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Free note */}
      <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-soft">
        <label className="text-[11px] tracking-widest text-ink-400 font-bold block mb-1.5">
          施術メモ
        </label>
        <textarea
          value={freeNote}
          onChange={(e) => setFreeNote(e.target.value)}
          rows={3}
          placeholder="例: 主訴は右肩こり。可動域に左右差あり。次回は脊柱起立筋を強めに。"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-accent"
        />
      </div>

      {/* Save button */}
      <button
        onClick={() => onSave(markers, freeNote)}
        disabled={saving}
        className="block w-full rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "保存中…" : "カルテを保存"}
      </button>

      {/* Part-picker modal (筋肉/骨格) */}
      {pendingPart && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black text-ink-900">
                {pendingPart.type === "muscle" ? "筋肉部位を選択" : "骨格部位を選択"}
              </h3>
              <button
                onClick={() => setPendingPart(null)}
                className="text-ink-400 hover:text-ink-900 text-xl leading-none"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-2">
              {(pendingPart.type === "muscle" ? MUSCLE_PARTS : SKELETAL_PARTS).map(
                (p) => (
                  <button
                    key={p}
                    onClick={() => confirmPart(p)}
                    className="rounded-lg border border-ink-100 bg-white px-3 py-2.5 text-sm font-bold text-ink-800 hover:border-accent hover:bg-accent-50 transition text-left"
                  >
                    {p}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
