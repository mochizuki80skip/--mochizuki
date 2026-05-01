// ===========================================================================
// 主要経穴データ。座標は SVG viewBox 0..100 の %。
// 概ね対称配置になるように手動で配置。実用に応じて追加可能。
//
// 「side: 'pair'」は左右対称ペア (定義は片側のみ、表示時にもう一方をミラー)。
// ===========================================================================

export type AcupointSide = "single" | "pair";
export type AcupointDef = {
  id: string;
  /** 表示用日本語ラベル */
  label: string;
  view: "front" | "back";
  /** 0..100 SVG % 座標。pair の場合は中心からの距離 (左側のx)。 */
  x: number;
  y: number;
  side: AcupointSide;
};

export const ACUPOINTS: AcupointDef[] = [
  // ===== 頭部・首 =====
  { id: "hyakue",   label: "百会",  view: "front", x: 50,   y: 4,  side: "single" },
  { id: "intou",    label: "印堂",  view: "front", x: 50,   y: 8,  side: "single" },
  { id: "tenchu",   label: "天柱",  view: "back",  x: 47,   y: 11, side: "pair"   },
  { id: "fuchi",    label: "風池",  view: "back",  x: 44,   y: 9,  side: "pair"   },
  { id: "fufu",     label: "風府",  view: "back",  x: 50,   y: 9,  side: "single" },
  { id: "naikan",   label: "大椎",  view: "back",  x: 50,   y: 14, side: "single" },
  // ===== 肩・肩甲骨 =====
  { id: "kenchu",   label: "肩中兪", view: "back", x: 43,   y: 14, side: "pair"   },
  { id: "keni",     label: "肩外兪", view: "back", x: 39,   y: 16, side: "pair"   },
  { id: "kensei",   label: "肩井",  view: "back",  x: 32,   y: 13, side: "pair"   },
  { id: "kenchuu",  label: "肩髎",  view: "back",  x: 28,   y: 16, side: "pair"   },
  { id: "tenryou",  label: "天髎",  view: "back",  x: 38,   y: 17, side: "pair"   },
  { id: "futei",    label: "附分",  view: "back",  x: 44,   y: 19, side: "pair"   },
  { id: "fumon",    label: "風門",  view: "back",  x: 47,   y: 18, side: "pair"   },
  // ===== 胸 =====
  { id: "danchu",   label: "膻中",  view: "front", x: 50,   y: 26, side: "single" },
  { id: "chuufu",   label: "中府",  view: "front", x: 38,   y: 23, side: "pair"   },
  // ===== 腕 =====
  { id: "kyokuchi", label: "曲池",  view: "front", x: 24,   y: 35, side: "pair"   },
  { id: "shutu",    label: "手三里", view: "front", x: 22,   y: 38, side: "pair"   },
  { id: "naikan2",  label: "内関",  view: "front", x: 21,   y: 44, side: "pair"   },
  { id: "taiei",    label: "太淵",  view: "front", x: 19,   y: 49, side: "pair"   },
  { id: "gokoku",   label: "合谷",  view: "front", x: 15,   y: 52, side: "pair"   },
  // ===== 腹 =====
  { id: "chuukan",  label: "中脘",  view: "front", x: 50,   y: 35, side: "single" },
  { id: "shinkyu",  label: "神闕",  view: "front", x: 50,   y: 41, side: "single" },
  { id: "kankan",   label: "関元",  view: "front", x: 50,   y: 46, side: "single" },
  { id: "tensu",    label: "天枢",  view: "front", x: 45,   y: 41, side: "pair"   },
  // ===== 背 =====
  { id: "haichu",   label: "肺兪",  view: "back",  x: 45,   y: 22, side: "pair"   },
  { id: "shinyu",   label: "心兪",  view: "back",  x: 45,   y: 26, side: "pair"   },
  { id: "kakuyu",   label: "膈兪",  view: "back",  x: 45,   y: 30, side: "pair"   },
  { id: "kanyu",    label: "肝兪",  view: "back",  x: 45,   y: 34, side: "pair"   },
  { id: "tannyu",   label: "胆兪",  view: "back",  x: 45,   y: 36, side: "pair"   },
  { id: "hiyu",     label: "脾兪",  view: "back",  x: 45,   y: 38, side: "pair"   },
  { id: "iyu",      label: "胃兪",  view: "back",  x: 45,   y: 40, side: "pair"   },
  { id: "shinyu2",  label: "腎兪",  view: "back",  x: 45,   y: 44, side: "pair"   },
  { id: "daichoyu", label: "大腸兪", view: "back", x: 45,   y: 48, side: "pair"   },
  { id: "shouchoyu",label: "小腸兪", view: "back", x: 45,   y: 51, side: "pair"   },
  { id: "boukouyu", label: "膀胱兪", view: "back", x: 45,   y: 54, side: "pair"   },
  { id: "meimon",   label: "命門",  view: "back",  x: 50,   y: 45, side: "single" },
  // ===== 臀部 =====
  { id: "kanchou",  label: "環跳",  view: "back",  x: 38,   y: 58, side: "pair"   },
  // ===== 下肢 (前面) =====
  { id: "ashisanli",label: "足三里", view: "front", x: 44,   y: 67, side: "pair"   },
  { id: "yourou",   label: "陽陵泉", view: "front", x: 42,   y: 68, side: "pair"   },
  { id: "sanin",    label: "三陰交", view: "front", x: 46,   y: 80, side: "pair"   },
  { id: "kekkai",   label: "血海",  view: "front", x: 44,   y: 60, side: "pair"   },
  { id: "taishou",  label: "太衝",  view: "front", x: 47,   y: 92, side: "pair"   },
  // ===== 下肢 (後面) =====
  { id: "iyuu",     label: "委中",  view: "back",  x: 46,   y: 67, side: "pair"   },
  { id: "shouzan",  label: "承山",  view: "back",  x: 47,   y: 78, side: "pair"   },
  { id: "fukuryu",  label: "復溜",  view: "back",  x: 48,   y: 84, side: "pair"   },
  { id: "taikei",   label: "太渓",  view: "back",  x: 49,   y: 88, side: "pair"   },
];

/**
 * 表示用に展開した経穴ポイント (pair は左右両方の x を計算した結果)。
 */
export type AcupointDot = {
  key: string;
  label: string;
  view: "front" | "back";
  x: number;
  y: number;
};

export function expandAcupoints(view: "front" | "back"): AcupointDot[] {
  const out: AcupointDot[] = [];
  for (const a of ACUPOINTS) {
    if (a.view !== view) continue;
    if (a.side === "single") {
      out.push({ key: a.id, label: a.label, view, x: a.x, y: a.y });
    } else {
      // pair: a.x は左側のx (中心50より小さい想定)。右側は 100 - a.x にミラー。
      out.push({ key: `${a.id}-l`, label: a.label, view, x: a.x, y: a.y });
      out.push({ key: `${a.id}-r`, label: a.label, view, x: 100 - a.x, y: a.y });
    }
  }
  return out;
}
