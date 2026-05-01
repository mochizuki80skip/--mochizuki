import { QUESTIONS } from "./questions";
import { SESSION_MESSAGES, patternFor } from "./treatment";
import {
  BENSHO_FOR_AXIS,
  type Answer,
  type AxisKey,
  type AxisLevel,
  type AxisResult,
  type BenshoKey,
  type BenshoResult,
  type DiagnoseResult,
  type DiagnoseType,
  type TreatmentEntry,
  type TreatmentPlan,
} from "./types";

const AXES: AxisKey[] = ["nerve", "circ", "metab"];
/** 大分類 tiebreak: 神経 > 循環 > 代謝 (per spec). */
const AXIS_TIEBREAK_RANK: Record<AxisKey, number> = {
  nerve: 0,
  circ: 1,
  metab: 2,
};

/**
 * Each 大分類 raw is the sum of 6 underlying questions (2 弁証 × 3 questions),
 * each 0..3 → 大分類 raw range is 0..18. Higher raw = more symptomatic.
 * Thresholds calibrated to ~25/45/65% of max.
 */
const LEVEL_THRESHOLDS: { min: number; level: AxisLevel }[] = [
  { min: 13, level: "strong" },   // 13-18
  { min: 9,  level: "off" },      // 9-12
  { min: 5,  level: "mild" },     // 5-8
  { min: 0,  level: "balanced" }, // 0-4
];

function levelFromRaw(raw: number): AxisLevel {
  for (const t of LEVEL_THRESHOLDS) {
    if (raw >= t.min) return t.level;
  }
  return "balanced";
}

export function computeResult(answers: Answer[]): DiagnoseResult {
  const map = new Map(answers.map((a) => [a.id, a.value]));

  // ----- 6 弁証 raw scores (0..9 each) -----
  const benshoMap = {} as Record<BenshoKey, BenshoResult>;
  const benshoKeys: BenshoKey[] = [
    "kikyo", "kitai", "kekkyo", "oketsu", "inkyo", "tanshitsu",
  ];
  for (const bk of benshoKeys) {
    const items = QUESTIONS.filter((q) => q.bensho === bk);
    const raw = items.reduce((sum, q) => sum + (map.get(q.id) ?? 0), 0);
    benshoMap[bk] = {
      key: bk,
      raw,
      // staff convention: high = strong tendency
      normalized: Math.round((raw / 9) * 100),
    };
  }

  // ----- 3 大分類 results (raw 0..18) -----
  const axisResults = {} as Record<AxisKey, AxisResult>;
  for (const axis of AXES) {
    const [a, b] = BENSHO_FOR_AXIS[axis];
    const raw = benshoMap[a].raw + benshoMap[b].raw;
    // patient convention: high = healthy. Invert so 0 raw → 100, 18 raw → 0.
    const normalized = Math.round(((18 - raw) / 18) * 100);
    axisResults[axis] = {
      axis,
      raw,
      normalized,
      level: levelFromRaw(raw),
    };
  }

  // ----- type_key (legacy 5-type for content lookup & list filters) -----
  const ranked = AXES
    .map((a) => axisResults[a])
    .sort((x, y) => y.raw - x.raw || AXIS_TIEBREAK_RANK[x.axis] - AXIS_TIEBREAK_RANK[y.axis]);

  const top = ranked[0];
  const second = ranked[1];

  let type: DiagnoseType = "balanced";
  let primary: AxisKey | null = null;
  let secondary: AxisKey | null = null;

  const isHigh = (lv: AxisLevel) => lv === "off" || lv === "strong";

  if (!isHigh(top.level)) {
    type = "balanced";
  } else if (isHigh(top.level) && isHigh(second.level)) {
    type = "compound";
    primary = top.axis;
    secondary = second.axis;
  } else {
    primary = top.axis;
    if (top.axis === "nerve") type = "nerve_excess";
    else if (top.axis === "circ") type = "circ_deficit";
    else type = "metab_low";
  }

  // ----- treatment plan -----
  const treatment = buildTreatmentPlan(axisResults, benshoMap);

  return {
    axes: axisResults,
    bensho: benshoMap,
    treatment,
    type,
    primary,
    secondary,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Rank 大分類 by raw score desc (tiebreak: 神経 > 循環 > 代謝).
 * For each 大分類, pick the higher-scoring of its two 弁証.
 * Tiebreak within 大分類: take the first 弁証 in BENSHO_FOR_AXIS order.
 */
function buildTreatmentPlan(
  axes: Record<AxisKey, AxisResult>,
  bensho: Record<BenshoKey, BenshoResult>,
): TreatmentPlan {
  const ordered: AxisKey[] = [...AXES].sort((a, b) => {
    const diff = axes[b].raw - axes[a].raw;
    if (diff !== 0) return diff;
    return AXIS_TIEBREAK_RANK[a] - AXIS_TIEBREAK_RANK[b];
  });

  const priority: TreatmentEntry[] = [];
  for (const axis of ordered) {
    const [a, b] = BENSHO_FOR_AXIS[axis];
    // Pick dominant 弁証. Tiebreak: first 弁証 in axis order (a wins).
    const dominant: BenshoKey = bensho[b].raw > bensho[a].raw ? b : a;
    const pat = patternFor(axis, dominant);
    if (!pat) continue;
    priority.push({
      axis,
      bensho: dominant,
      chiho: pat.chiho,
      points: pat.points,
      axisScore: axes[axis].raw,
    });
  }

  return {
    priority,
    sessions: { ...SESSION_MESSAGES },
  };
}

export const LEVEL_LABEL: Record<AxisLevel, { ja: string; tone: string }> = {
  balanced: { ja: "良好", tone: "text-ok" },
  mild:     { ja: "やや乱れ", tone: "text-ink-500" },
  off:      { ja: "不調傾向", tone: "text-warn" },
  strong:   { ja: "強い不調", tone: "text-ng" },
};

/**
 * Single 0-100 number that summarises overall constitution health, computed
 * as the average of the three axis-normalised scores. High = healthy
 * (consistent with the inverted patient-facing direction).
 */
export function constitutionScore(axes: Record<AxisKey, AxisResult>): number {
  return Math.round(
    (axes.nerve.normalized + axes.circ.normalized + axes.metab.normalized) / 3,
  );
}
