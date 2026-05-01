import type { AxisKey, BenshoKey, TreatmentSessions } from "./types";

// ===========================================================================
// 経穴・治法マスタ
// 6 弁証 × 4 経穴 (per spec table 8.2-6.3).
// ===========================================================================

export type AcupointPattern = {
  /** 治法 — therapeutic principle */
  chiho: string;
  /** 4 主要経穴 */
  points: string[];
};

export const TREATMENT_MASTER: Record<AxisKey, Record<BenshoKey, AcupointPattern | undefined>> = {
  nerve: {
    kikyo:     { chiho: "補気・補益", points: ["太淵", "合谷", "足三里", "承山"] },
    kitai:     { chiho: "理気・行気", points: ["百会", "内関", "陽陵泉", "侠谿"] },
    kekkyo:    undefined,
    oketsu:    undefined,
    inkyo:     undefined,
    tanshitsu: undefined,
  },
  circ: {
    kikyo:     undefined,
    kitai:     undefined,
    kekkyo:    { chiho: "補血・養血", points: ["陽池", "会宗", "血海", "三陰交"] },
    oketsu:    { chiho: "活血化瘀", points: ["列欠", "四犢", "陰谷", "太衝"] },
    inkyo:     undefined,
    tanshitsu: undefined,
  },
  metab: {
    kikyo:     undefined,
    kitai:     undefined,
    kekkyo:    undefined,
    oketsu:    undefined,
    inkyo:     { chiho: "補陰・滋陰", points: ["尺沢", "大陵", "復溜", "太渓"] },
    tanshitsu: { chiho: "化痰・除湿", points: ["後谿", "曲池", "豊隆", "陰陵泉"] },
  },
};

export function patternFor(
  axis: AxisKey,
  bensho: BenshoKey,
): AcupointPattern | null {
  return TREATMENT_MASTER[axis]?.[bensho] ?? null;
}

// ===========================================================================
// 回数別メッセージ（仮文章 — 院の運用に合わせて後から差し替え）
// ===========================================================================

export const SESSION_MESSAGES: TreatmentSessions = {
  first:
    "初回は気・血・水のうち最も乱れが大きい部分から整えていきます。施術後72時間は無理をせず、温かい飲食と早めの就寝を心がけてください。",
  second:
    "2回目は初回からの変化を踏まえ、メインの経穴に加えて関連する経穴を組み合わせて深く整えます。前回からの体感の変化をぜひお伝えください。",
  third:
    "3回目で全体のバランスを仕上げます。ここまでの3回の流れで多くの方が「以前との違い」を実感されます。今後は2-3週間に1度のメンテナンスをおすすめしています。",
};
