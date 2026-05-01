// ===========================================================================
// 筋肉調整 / 骨格矯正で「部位を選択 → イラストの該当箇所をハイライト」する
// ためのレンダーデータ。
// 座標系: SVG viewBox 0..100 × 0..133.33 (BodySilhouette と同じ)
// 8等身比 (1H=15) ベース、解剖ランドマークに合わせて配置。
//
// 主要ランドマーク (再掲):
//   y=22 chin / y=27 C7-肩線 / y=37 乳頭 / y=47 剣状 / y=52 臍
//   y=58 関元 / y=67 恥骨 / y=82 大腿中央 / y=97 膝 / y=120 踝 / y=128 足
//   x=28/72 肩 / x=22/78 肘 / x=16/84 手首 / x=33/67 大転子
//   x=38/62 ASIS / x=41/59 膝
// ===========================================================================

import { MUSCLE_PARTS, SKELETAL_PARTS } from "./chart-parts";

export type RegionShape =
  | { kind: "ellipse"; view: "front" | "back"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "rect";    view: "front" | "back"; x: number; y: number; w: number; h: number; rxRound?: number }
  | { kind: "polygon"; view: "front" | "back"; points: [number, number][] };

export type PartRegion = {
  group: string;
  shapes: RegionShape[];
};

// ---------------------------------------------------------------------------
// 筋肉 — 15部位
// ---------------------------------------------------------------------------
export const MUSCLE_REGIONS: Record<(typeof MUSCLE_PARTS)[number], PartRegion> = {
  "僧帽筋": {
    group: "首・肩",
    shapes: [
      // 後頭骨〜C7〜両肩 + 上背 (扇形)
      { kind: "polygon", view: "back",
        points: [[35,23],[50,21],[65,23],[68,32],[50,42],[32,32]] },
    ],
  },
  "肩甲挙筋": {
    group: "首・肩",
    shapes: [
      { kind: "ellipse", view: "back", cx: 41, cy: 26, rx: 4, ry: 5 },
      { kind: "ellipse", view: "back", cx: 59, cy: 26, rx: 4, ry: 5 },
    ],
  },
  "三角筋": {
    group: "首・肩",
    shapes: [
      // 肩関節を覆う三角形 (前後両方)
      { kind: "polygon", view: "front",
        points: [[24,28],[34,28],[32,40],[24,38]] },
      { kind: "polygon", view: "front",
        points: [[66,28],[76,28],[76,38],[68,40]] },
      { kind: "polygon", view: "back",
        points: [[24,28],[34,28],[32,40],[24,38]] },
      { kind: "polygon", view: "back",
        points: [[66,28],[76,28],[76,38],[68,40]] },
    ],
  },
  "広背筋": {
    group: "背中",
    shapes: [
      // 肩甲下〜腰方形筋上、腋窩〜腸骨稜
      { kind: "polygon", view: "back",
        points: [[32,38],[68,38],[64,58],[50,62],[36,58]] },
    ],
  },
  "脊柱起立筋": {
    group: "背中",
    shapes: [
      // 脊柱両側 (T1〜L5) を縦長矩形で
      { kind: "rect", view: "back", x: 44, y: 28, w: 12, h: 38, rxRound: 2 },
    ],
  },
  "腰方形筋": {
    group: "腰・骨盤",
    shapes: [
      { kind: "ellipse", view: "back", cx: 41, cy: 60, rx: 4, ry: 5 },
      { kind: "ellipse", view: "back", cx: 59, cy: 60, rx: 4, ry: 5 },
    ],
  },
  "大臀筋": {
    group: "腰・骨盤",
    shapes: [
      // 臀裂を中心とした台形
      { kind: "polygon", view: "back",
        points: [[34,68],[66,68],[68,80],[50,84],[32,80]] },
    ],
  },
  "中臀筋": {
    group: "腰・骨盤",
    shapes: [
      // 大転子上方
      { kind: "ellipse", view: "back", cx: 32, cy: 72, rx: 4, ry: 4 },
      { kind: "ellipse", view: "back", cx: 68, cy: 72, rx: 4, ry: 4 },
    ],
  },
  "腸腰筋": {
    group: "腰・骨盤",
    shapes: [
      // 鼠径〜下腹
      { kind: "ellipse", view: "front", cx: 42, cy: 65, rx: 4, ry: 5 },
      { kind: "ellipse", view: "front", cx: 58, cy: 65, rx: 4, ry: 5 },
    ],
  },
  "ハムストリング": {
    group: "脚",
    shapes: [
      // 大腿後面 (臀下〜膝裏)
      { kind: "rect", view: "back", x: 35, y: 80, w: 10, h: 16, rxRound: 4 },
      { kind: "rect", view: "back", x: 55, y: 80, w: 10, h: 16, rxRound: 4 },
    ],
  },
  "大腿四頭筋": {
    group: "脚",
    shapes: [
      // 大腿前面 (鼠径下〜膝)
      { kind: "rect", view: "front", x: 36, y: 72, w: 10, h: 22, rxRound: 4 },
      { kind: "rect", view: "front", x: 54, y: 72, w: 10, h: 22, rxRound: 4 },
    ],
  },
  "腓腹筋・ヒラメ筋": {
    group: "脚",
    shapes: [
      // ふくらはぎ
      { kind: "rect", view: "back", x: 37, y: 100, w: 9, h: 14, rxRound: 4 },
      { kind: "rect", view: "back", x: 54, y: 100, w: 9, h: 14, rxRound: 4 },
    ],
  },
  "上腕二頭筋": {
    group: "腕",
    shapes: [
      // 肩〜肘の上腕前面
      { kind: "rect", view: "front", x: 19, y: 30, w: 7, h: 16, rxRound: 3 },
      { kind: "rect", view: "front", x: 74, y: 30, w: 7, h: 16, rxRound: 3 },
    ],
  },
  "上腕三頭筋": {
    group: "腕",
    shapes: [
      // 肩〜肘の上腕後面
      { kind: "rect", view: "back", x: 19, y: 30, w: 7, h: 16, rxRound: 3 },
      { kind: "rect", view: "back", x: 74, y: 30, w: 7, h: 16, rxRound: 3 },
    ],
  },
  "前腕屈筋・伸筋群": {
    group: "腕",
    shapes: [
      // 肘〜手首
      { kind: "rect", view: "front", x: 14, y: 50, w: 8, h: 14, rxRound: 3 },
      { kind: "rect", view: "front", x: 78, y: 50, w: 8, h: 14, rxRound: 3 },
      { kind: "rect", view: "back",  x: 14, y: 50, w: 8, h: 14, rxRound: 3 },
      { kind: "rect", view: "back",  x: 78, y: 50, w: 8, h: 14, rxRound: 3 },
    ],
  },
};

// ---------------------------------------------------------------------------
// 骨格 — 10部位
// ---------------------------------------------------------------------------
export const SKELETAL_REGIONS: Record<(typeof SKELETAL_PARTS)[number], PartRegion> = {
  "頸椎": {
    group: "脊柱",
    shapes: [
      // C1-C7、首正中
      { kind: "rect", view: "back", x: 47, y: 18, w: 6, h: 9, rxRound: 1.5 },
    ],
  },
  "胸椎": {
    group: "脊柱",
    shapes: [
      // T1-T12 (大椎下〜L1上)
      { kind: "rect", view: "back", x: 47, y: 27, w: 6, h: 25, rxRound: 1.5 },
    ],
  },
  "腰椎": {
    group: "脊柱",
    shapes: [
      // L1-L5
      { kind: "rect", view: "back", x: 47, y: 53, w: 6, h: 13, rxRound: 1.5 },
    ],
  },
  "仙骨": {
    group: "脊柱",
    shapes: [
      // S1-S5
      { kind: "rect", view: "back", x: 46, y: 66, w: 8, h: 8, rxRound: 1.5 },
    ],
  },
  "骨盤(仙腸関節)": {
    group: "骨盤",
    shapes: [
      // 腸骨〜恥骨
      { kind: "polygon", view: "front",
        points: [[36,62],[64,62],[68,75],[50,78],[32,75]] },
      { kind: "polygon", view: "back",
        points: [[36,62],[64,62],[68,75],[50,78],[32,75]] },
    ],
  },
  "肩関節": {
    group: "上肢",
    shapes: [
      { kind: "ellipse", view: "front", cx: 28, cy: 30, rx: 5, ry: 5 },
      { kind: "ellipse", view: "front", cx: 72, cy: 30, rx: 5, ry: 5 },
      { kind: "ellipse", view: "back",  cx: 28, cy: 30, rx: 5, ry: 5 },
      { kind: "ellipse", view: "back",  cx: 72, cy: 30, rx: 5, ry: 5 },
    ],
  },
  "肘関節": {
    group: "上肢",
    shapes: [
      { kind: "ellipse", view: "front", cx: 22, cy: 50, rx: 4, ry: 4 },
      { kind: "ellipse", view: "front", cx: 78, cy: 50, rx: 4, ry: 4 },
      { kind: "ellipse", view: "back",  cx: 22, cy: 50, rx: 4, ry: 4 },
      { kind: "ellipse", view: "back",  cx: 78, cy: 50, rx: 4, ry: 4 },
    ],
  },
  "手関節": {
    group: "上肢",
    shapes: [
      { kind: "ellipse", view: "front", cx: 16, cy: 66, rx: 4, ry: 3 },
      { kind: "ellipse", view: "front", cx: 84, cy: 66, rx: 4, ry: 3 },
      { kind: "ellipse", view: "back",  cx: 16, cy: 66, rx: 4, ry: 3 },
      { kind: "ellipse", view: "back",  cx: 84, cy: 66, rx: 4, ry: 3 },
    ],
  },
  "股関節": {
    group: "下肢",
    shapes: [
      { kind: "ellipse", view: "front", cx: 38, cy: 72, rx: 5, ry: 5 },
      { kind: "ellipse", view: "front", cx: 62, cy: 72, rx: 5, ry: 5 },
      { kind: "ellipse", view: "back",  cx: 38, cy: 72, rx: 5, ry: 5 },
      { kind: "ellipse", view: "back",  cx: 62, cy: 72, rx: 5, ry: 5 },
    ],
  },
  "膝関節": {
    group: "下肢",
    shapes: [
      { kind: "ellipse", view: "front", cx: 41, cy: 97, rx: 4, ry: 4 },
      { kind: "ellipse", view: "front", cx: 59, cy: 97, rx: 4, ry: 4 },
      { kind: "ellipse", view: "back",  cx: 41, cy: 97, rx: 4, ry: 4 },
      { kind: "ellipse", view: "back",  cx: 59, cy: 97, rx: 4, ry: 4 },
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
