"use client";

import { useState } from "react";
import ChartCanvas from "./ChartCanvas";
import { MARKER_META } from "./MarkerIcon";
import {
  MUSCLE_GROUPS,
  SKELETAL_GROUPS,
  partsInGroup,
} from "@/lib/body-regions";
import { totalAcupointCount, type AcupointMode } from "@/lib/acupoints";
import type {
  ChartMarker,
  ChartMarkerType,
  ChartView,
} from "@/lib/types";

const POINT_TYPES: ChartMarkerType[] = ["needle", "intra", "moxa", "manual"];
const REGION_TYPES: ChartMarkerType[] = ["muscle", "skeletal"];

type Props = {
  initialMarkers: ChartMarker[];
  initialFreeNote: string;
  onSave: (markers: ChartMarker[], freeNote: string) => Promise<void> | void;
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
  const [showAcupoints, setShowAcupoints] = useState(true);
  const [acupointMode, setAcupointMode] = useState<AcupointMode>("main");
  const [selectedType, setSelectedType] =
    useState<ChartMarkerType>("needle");
  const [markers, setMarkers] = useState<ChartMarker[]>(initialMarkers);
  const [freeNote, setFreeNote] = useState(initialFreeNote);
  // 部位選択モーダル: type ("muscle"/"skeletal") のみで開く。
  // group 選択 → parts 一覧 → タップで toggle。
  const [partPicker, setPartPicker] = useState<{
    type: "muscle" | "skeletal";
  } | null>(null);
  const [pickerGroup, setPickerGroup] = useState<string | null>(null);

  function addPointMarker(args: { x: number; y: number; type: ChartMarkerType }) {
    setMarkers((prev) => [
      ...prev,
      { id: uid(), view, x: args.x, y: args.y, type: args.type },
    ]);
  }

  function removeMarker(id: string) {
    if (!confirm("このマーカーを削除しますか？")) return;
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  }

  function isPartSelected(type: "muscle" | "skeletal", part: string): boolean {
    return markers.some((m) => m.type === type && m.part === part);
  }

  function togglePart(type: "muscle" | "skeletal", part: string) {
    if (isPartSelected(type, part)) {
      setMarkers((prev) =>
        prev.filter((m) => !(m.type === type && m.part === part)),
      );
    } else {
      setMarkers((prev) => [
        ...prev,
        { id: uid(), view, x: 0, y: 0, type, part },
      ]);
    }
  }

  function selectedRegionParts(type: "muscle" | "skeletal"): string[] {
    return markers
      .filter((m) => m.type === type && typeof m.part === "string")
      .map((m) => m.part as string);
  }

  function openPartPicker(type: "muscle" | "skeletal") {
    setPartPicker({ type });
    setPickerGroup(null);
  }
  function closePartPicker() {
    setPartPicker(null);
    setPickerGroup(null);
  }

  const visiblePointCount = markers.filter(
    (m) => m.view === view && m.type !== "muscle" && m.type !== "skeletal",
  ).length;
  const muscleCount = selectedRegionParts("muscle").length;
  const skeletalCount = selectedRegionParts("skeletal").length;

  return (
    <div className="space-y-3">
      {/* View tabs */}
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

      {/* Acupoint toggles */}
      <div className="flex items-center gap-2 flex-wrap">
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
        <span className="ml-auto text-[10px] tracking-widest text-ink-400">
          {view === "front" ? "正面" : "背面"} : {visiblePointCount}件
        </span>
      </div>

      {showAcupoints && (
        <p className="text-[10px] text-ink-400 -mt-1">
          {acupointMode === "main"
            ? `主要40穴を精密配置 (院での頻用穴)`
            : `WHO 標準 ${totalAcupointCount("full")} 穴 (経絡パスから概略配置・ズーム推奨)`}
        </p>
      )}

      {/* Body canvas */}
      <div className="rounded-2xl border border-ink-100 bg-white p-2 shadow-soft">
        <ChartCanvas
          view={view}
          showAcupoints={showAcupoints}
          acupointMode={acupointMode}
          markers={markers}
          editable={true}
          selectedType={selectedType}
          onAddPoint={addPointMarker}
          onLongPressMarker={removeMarker}
        />
        <p className="text-[10px] text-ink-400 text-center mt-1">
          鍼/円皮鍼/灸/手技 = タップで配置・長押しで削除 / ズームはイラスト右上のボタン
        </p>
      </div>

      {/* Marker palette: 点マーカー (タップ配置) */}
      <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-soft">
        <div className="text-[11px] tracking-widest text-ink-400 font-bold mb-2">
          配置するマーカー (体図をタップ)
        </div>
        <div className="grid grid-cols-4 gap-2">
          {POINT_TYPES.map((t) => {
            const meta = MARKER_META[t];
            const selected = selectedType === t;
            return (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={[
                  "flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-[11px] font-bold transition",
                  selected
                    ? "border-accent bg-accent-50 text-ink-900"
                    : "border-ink-100 bg-white text-ink-700 hover:border-ink-200",
                ].join(" ")}
                aria-pressed={selected}
              >
                <span
                  aria-hidden
                  className="inline-block w-4 h-4 rounded-full"
                  style={{ background: meta.color }}
                />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 部位選択 (筋肉調整 / 骨格矯正) */}
      <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-soft">
        <div className="text-[11px] tracking-widest text-ink-400 font-bold mb-2">
          部位を選択 (体図に色付きハイライト)
        </div>
        <div className="grid grid-cols-2 gap-2">
          {REGION_TYPES.map((t) => {
            const meta = MARKER_META[t];
            const count = selectedRegionParts(t as "muscle" | "skeletal").length;
            return (
              <button
                key={t}
                onClick={() => openPartPicker(t as "muscle" | "skeletal")}
                className="flex items-center justify-between rounded-lg border border-ink-100 bg-white px-3 py-2.5 hover:border-accent transition"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-ink-900">
                  <span
                    aria-hidden
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ background: meta.color }}
                  />
                  {meta.label}
                </span>
                <span className="text-[11px] tabular-nums text-ink-500">
                  {count} 部位
                </span>
              </button>
            );
          })}
        </div>
        {(muscleCount > 0 || skeletalCount > 0) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedRegionParts("muscle").map((p) => (
              <span
                key={`m-${p}`}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
              >
                筋 / {p}
                <button
                  type="button"
                  onClick={() => togglePart("muscle", p)}
                  className="text-amber-600 hover:text-amber-900"
                  aria-label="削除"
                >
                  ×
                </button>
              </span>
            ))}
            {selectedRegionParts("skeletal").map((p) => (
              <span
                key={`s-${p}`}
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 border border-ink-200"
              >
                骨 / {p}
                <button
                  type="button"
                  onClick={() => togglePart("skeletal", p)}
                  className="text-ink-400 hover:text-ink-900"
                  aria-label="削除"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
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

      {/* Part-picker modal */}
      {partPicker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black text-ink-900">
                {partPicker.type === "muscle" ? "筋肉調整" : "骨格矯正"}
                {pickerGroup && (
                  <span className="text-sm text-ink-500 font-normal ml-1">
                    / {pickerGroup}
                  </span>
                )}
              </h3>
              <button
                onClick={closePartPicker}
                className="text-ink-400 hover:text-ink-900 text-xl leading-none"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            {!pickerGroup ? (
              // Step 1: グループ選択
              <>
                <p className="text-xs text-ink-500 mb-2">大まかな部位を選択</p>
                <div className="grid grid-cols-2 gap-2 overflow-y-auto">
                  {(partPicker.type === "muscle"
                    ? MUSCLE_GROUPS
                    : SKELETAL_GROUPS
                  ).map((g) => {
                    const partsInG = partsInGroup(partPicker.type, g);
                    const selectedHere = partsInG.filter((p) =>
                      isPartSelected(partPicker.type, p),
                    ).length;
                    return (
                      <button
                        key={g}
                        onClick={() => setPickerGroup(g)}
                        className="rounded-xl border border-ink-100 bg-white px-3 py-3 text-sm font-bold text-ink-900 hover:border-accent hover:bg-accent-50 transition text-left"
                      >
                        {g}
                        <div className="text-[10px] text-ink-500 font-normal mt-0.5">
                          {partsInG.length} 部位
                          {selectedHere > 0 && (
                            <span className="text-accent-600 font-bold ml-1">
                              ・{selectedHere} 選択中
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              // Step 2: パーツ選択 (multi-select toggle)
              <>
                <button
                  onClick={() => setPickerGroup(null)}
                  className="text-xs text-ink-400 hover:text-ink-900 mb-2 self-start"
                >
                  ← 部位グループに戻る
                </button>
                <p className="text-xs text-ink-500 mb-2">
                  タップで選択 / もう一度で解除（複数選択可）
                </p>
                <div className="grid grid-cols-1 gap-2 overflow-y-auto">
                  {partsInGroup(partPicker.type, pickerGroup).map((p) => {
                    const selected = isPartSelected(partPicker.type, p);
                    return (
                      <button
                        key={p}
                        onClick={() => togglePart(partPicker.type, p)}
                        className={[
                          "flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-bold transition text-left",
                          selected
                            ? "border-accent bg-accent-50 text-ink-900"
                            : "border-ink-100 bg-white text-ink-800 hover:border-ink-200",
                        ].join(" ")}
                      >
                        <span>{p}</span>
                        {selected && (
                          <span className="text-accent-600 text-xs">
                            ✓ 選択中
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={closePartPicker}
                  className="mt-3 w-full rounded-full bg-ink-900 text-white font-bold text-sm py-2.5 hover:bg-ink-700 transition"
                >
                  完了
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
