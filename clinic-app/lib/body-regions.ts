// ===========================================================================
// 筋肉調整 / 骨格矯正で「部位を選択 → イラストの該当箇所をハイライト」する
// ためのレンダーデータ。
// 座標系: SVG viewBox 0..100 × 0..133 (BodySilhouette と同じ)。
// 1部位は複数のシェイプ (front/back × ellipse/polygon) を持つことができ、
// 選択時に半透明色を重ねる。
// ===========================================================================

import { MUSCLE_PARTS, SKELETAL_PARTS } from "./chart-parts";

export type RegionShape =
  | { kind: "ellipse"; view: "front" | "back"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "rect";    view: "front" | "back"; x: number; y: number; w: number; h: number; rxRound?: number }
  | { kind: "polygon"; view: "front" | "back"; points: [number, number][] };

export type PartRegion = {
  /** 大まかなグループ (UI の階層ボタン用) */
  group: string;
  /** ハイライト形状 */
  shapes: RegionShape[];
};

// ---------------------------------------------------------------------------
// 筋肉 — 15 部位
// ---------------------------------------------------------------------------
export const MUSCLE_REGIONS: Record<(typeof MUSCLE_PARTS)[number], PartRegion> = {
  "僧帽筋": {
    group: "首・肩",
    shapes: [
      { kind: "polygon", view: "back", points: [[36,17],[64,17],[60,30],[50,36],[40,30]] },
    ],
  },
  "肩甲挙筋": {
    group: "首・肩",
    shapes: [
      { kind: "ellipse", view: "back", cx: 42, cy: 22, rx: 5, ry: 6 },
      { kind: "ellipse", view: "back", cx: 58, cy: 22, rx: 5, ry: 6 },
    ],
  },
  "三角筋": {
    group: "首・肩",
    shapes: [
      { kind: "ellipse", view: "front", cx: 28, cy: 28, rx: 6, ry: 7 },
      { kind: "ellipse", view: "front", cx: 72, cy: 28, rx: 6, ry: 7 },
      { kind: "ellipse", view: "back",  cx: 28, cy: 28, rx: 6, ry: 7 },
      { kind: "ellipse", view: "back",  cx: 72, cy: 28, rx: 6, ry: 7 },
    ],
  },
  "広背筋": {
    group: "背中",
    shapes: [
      { kind: "polygon", view: "back", points: [[34,32],[66,32],[62,52],[50,55],[38,52]] },
    ],
  },
  "脊柱起立筋": {
    group: "背中",
    shapes: [
      { kind: "rect", view: "back", x: 43, y: 22, w: 14, h: 38, rxRound: 3 },
    ],
  },
  "腰方形筋": {
    group: "腰・骨盤",
    shapes: [
      { kind: "ellipse", view: "back", cx: 40, cy: 56, rx: 5, ry: 6 },
      { kind: "ellipse", view: "back", cx: 60, cy: 56, rx: 5, ry: 6 },
    ],
  },
  "大臀筋": {
    group: "腰・骨盤",
    shapes: [
      { kind: "polygon", view: "back", points: [[35,62],[65,62],[68,76],[50,82],[32,76]] },
    ],
  },
  "中臀筋": {
    group: "腰・骨盤",
    shapes: [
      { kind: "ellipse", view: "back", cx: 32, cy: 66, rx: 5, ry: 5 },
      { kind: "ellipse", view: "back", cx: 68, cy: 66, rx: 5, ry: 5 },
    ],
  },
  "腸腰筋": {
    group: "腰・骨盤",
    shapes: [
      { kind: "ellipse", view: "front", cx: 42, cy: 60, rx: 5, ry: 6 },
      { kind: "ellipse", view: "front", cx: 58, cy: 60, rx: 5, ry: 6 },
    ],
  },
  "ハムストリング": {
    group: "脚",
    shapes: [
      { kind: "rect", view: "back", x: 33, y: 78, w: 12, h: 18, rxRound: 4 },
      { kind: "rect", view: "back", x: 55, y: 78, w: 12, h: 18, rxRound: 4 },
    ],
  },
  "大腿四頭筋": {
    group: "脚",
    shapes: [
      { kind: "rect", view: "front", x: 33, y: 72, w: 12, h: 22, rxRound: 4 },
      { kind: "rect", view: "front", x: 55, y: 72, w: 12, h: 22, rxRound: 4 },
    ],
  },
  "腓腹筋・ヒラメ筋": {
    group: "脚",
    shapes: [
      { kind: "rect", view: "back", x: 36, y: 100, w: 10, h: 14, rxRound: 4 },
      { kind: "rect", view: "back", x: 54, y: 100, w: 10, h: 14, rxRound: 4 },
    ],
  },
  "上腕二頭筋": {
    group: "腕",
    shapes: [
      { kind: "rect", view: "front", x: 18, y: 30, w: 8, h: 14, rxRound: 3 },
      { kind: "rect", view: "front", x: 74, y: 30, w: 8, h: 14, rxRound: 3 },
    ],
  },
  "上腕三頭筋": {
    group: "腕",
    shapes: [
      { kind: "rect", view: "back", x: 18, y: 30, w: 8, h: 14, rxRound: 3 },
      { kind: "rect", view: "back", x: 74, y: 30, w: 8, h: 14, rxRound: 3 },
    ],
  },
  "前腕屈筋・伸筋群": {
    group: "腕",
    shapes: [
      { kind: "rect", view: "front", x: 14, y: 46, w: 8, h: 14, rxRound: 3 },
      { kind: "rect", view: "front", x: 78, y: 46, w: 8, h: 14, rxRound: 3 },
      { kind: "rect", view: "back",  x: 14, y: 46, w: 8, h: 14, rxRound: 3 },
      { kind: "rect", view: "back",  x: 78, y: 46, w: 8, h: 14, rxRound: 3 },
    ],
  },
};

// ---------------------------------------------------------------------------
// 骨格 — 10 部位
// ---------------------------------------------------------------------------
export const SKELETAL_REGIONS: Record<(typeof SKELETAL_PARTS)[number], PartRegion> = {
  "頸椎": {
    group: "脊柱",
    shapes: [
      { kind: "rect", view: "back", x: 47, y: 13, w: 6, h: 8, rxRound: 1.5 },
    ],
  },
  "胸椎": {
    group: "脊柱",
    shapes: [
      { kind: "rect", view: "back", x: 47, y: 22, w: 6, h: 22, rxRound: 1.5 },
    ],
  },
  "腰椎": {
    group: "脊柱",
    shapes: [
      { kind: "rect", view: "back", x: 47, y: 45, w: 6, h: 14, rxRound: 1.5 },
    ],
  },
  "仙骨": {
    group: "脊柱",
    shapes: [
      { kind: "rect", view: "back", x: 46, y: 60, w: 8, h: 8, rxRound: 1.5 },
    ],
  },
  "骨盤(仙腸関節)": {
    group: "骨盤",
    shapes: [
      { kind: "polygon", view: "back",  points: [[36,60],[64,60],[68,72],[50,76],[32,72]] },
      { kind: "polygon", view: "front", points: [[36,60],[64,60],[68,72],[50,76],[32,72]] },
    ],
  },
  "肩関節": {
    group: "上肢",
    shapes: [
      { kind: "ellipse", view: "front", cx: 28, cy: 24, rx: 5, ry: 5 },
      { kind: "ellipse", view: "front", cx: 72, cy: 24, rx: 5, ry: 5 },
      { kind: "ellipse", view: "back",  cx: 28, cy: 24, rx: 5, ry: 5 },
      { kind: "ellipse", view: "back",  cx: 72, cy: 24, rx: 5, ry: 5 },
    ],
  },
  "肘関節": {
    group: "上肢",
    shapes: [
      { kind: "ellipse", view: "front", cx: 22, cy: 44, rx: 4, ry: 4 },
      { kind: "ellipse", view: "front", cx: 78, cy: 44, rx: 4, ry: 4 },
      { kind: "ellipse", view: "back",  cx: 22, cy: 44, rx: 4, ry: 4 },
      { kind: "ellipse", view: "back",  cx: 78, cy: 44, rx: 4, ry: 4 },
    ],
  },
  "手関節": {
    group: "上肢",
    shapes: [
      { kind: "ellipse", view: "front", cx: 16, cy: 60, rx: 4, ry: 3 },
      { kind: "ellipse", view: "front", cx: 84, cy: 60, rx: 4, ry: 3 },
      { kind: "ellipse", view: "back",  cx: 16, cy: 60, rx: 4, ry: 3 },
      { kind: "ellipse", view: "back",  cx: 84, cy: 60, rx: 4, ry: 3 },
    ],
  },
  "股関節": {
    group: "下肢",
    shapes: [
      { kind: "ellipse", view: "front", cx: 38, cy: 67, rx: 5, ry: 5 },
      { kind: "ellipse", view: "front", cx: 62, cy: 67, rx: 5, ry: 5 },
      { kind: "ellipse", view: "back",  cx: 38, cy: 67, rx: 5, ry: 5 },
      { kind: "ellipse", view: "back",  cx: 62, cy: 67, rx: 5, ry: 5 },
    ],
  },
  "膝関節": {
    group: "下肢",
    shapes: [
      { kind: "ellipse", view: "front", cx: 42, cy: 92, rx: 4, ry: 4 },
      { kind: "ellipse", view: "front", cx: 58, cy: 92, rx: 4, ry: 4 },
      { kind: "ellipse", view: "back",  cx: 42, cy: 92, rx: 4, ry: 4 },
      { kind: "ellipse", view: "back",  cx: 58, cy: 92, rx: 4, ry: 4 },
    ],
  },
};

export const MUSCLE_GROUPS: string[] = Array.from(
  new Set(Object.values(MUSCLE_REGIONS).map((r) => r.group)),
);
export const SKELETAL_GROUPS: string[] = Array.from(
  new Set(Object.values(SKELETAL_REGIONS).map((r) => r.group)),
);

export function partsInGroup(
  type: "muscle" | "skeletal",
  group: string,
): string[] {
  const map = type === "muscle" ? MUSCLE_REGIONS : SKELETAL_REGIONS;
  return Object.entries(map)
    .filter(([, r]) => r.group === group)
    .map(([name]) => name);
}

export function getPartRegion(
  type: "muscle" | "skeletal",
  part: string,
): PartRegion | null {
  const map = type === "muscle" ? MUSCLE_REGIONS : SKELETAL_REGIONS;
  return (map as Record<string, PartRegion>)[part] ?? null;
}
