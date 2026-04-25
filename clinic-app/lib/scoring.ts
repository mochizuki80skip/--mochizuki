import { QUESTIONS } from "./questions";
import type {
  Answer,
  AxisKey,
  AxisLevel,
  AxisResult,
  DiagnoseResult,
  DiagnoseType,
} from "./types";

const AXES: AxisKey[] = ["nerve", "circ", "metab"];

const LEVEL_THRESHOLDS: { min: number; level: AxisLevel }[] = [
  { min: 20, level: "strong" }, // 20-25
  { min: 15, level: "off" },    // 15-19
  { min: 10, level: "mild" },   // 10-14
  { min: 0,  level: "balanced" }, // 5-9
];

function levelFromRaw(raw: number): AxisLevel {
  for (const t of LEVEL_THRESHOLDS) {
    if (raw >= t.min) return t.level;
  }
  return "balanced";
}

export function computeResult(answers: Answer[]): DiagnoseResult {
  const map = new Map(answers.map((a) => [a.id, a.value]));

  const axisResults = {} as Record<AxisKey, AxisResult>;
  for (const axis of AXES) {
    const items = QUESTIONS.filter((q) => q.axis === axis);
    const raw = items.reduce((sum, q) => sum + (map.get(q.id) ?? 1), 0);
    // Questions are framed as "how often do you experience this DYSFUNCTION",
    // so high raw = many symptoms. We invert to display: high score = healthy,
    // low score = poor (raw 5 → 100, raw 25 → 0).
    const normalized = Math.round(((25 - raw) / 20) * 100);
    axisResults[axis] = {
      axis,
      raw,
      normalized,
      level: levelFromRaw(raw),
    };
  }

  // Determine type by ranking dysregulation
  const ranked = AXES
    .map((a) => axisResults[a])
    .sort((a, b) => b.raw - a.raw);

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

  return {
    axes: axisResults,
    type,
    primary,
    secondary,
    createdAt: new Date().toISOString(),
  };
}

export const LEVEL_LABEL: Record<AxisLevel, { ja: string; tone: string }> = {
  balanced: { ja: "良好", tone: "text-ok" },
  mild:     { ja: "やや乱れ", tone: "text-ink-500" },
  off:      { ja: "不調傾向", tone: "text-warn" },
  strong:   { ja: "強い不調", tone: "text-ng" },
};
