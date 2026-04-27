// Daily log option lists. Tweak labels here when the clinic wants to change
// which symptoms are tracked — every UI surface reads from these arrays.

// --- Pain body parts (refactored from symptom tags) -------------------

export type BodyPartCategory = "upper" | "trunk" | "lower" | "other";

export type BodyPart = {
  key: string;
  label: string;
  category: BodyPartCategory;
  /** When true the user can specify a free-text description (used for "other"). */
  freeText?: boolean;
};

export const BODY_PARTS: BodyPart[] = [
  // 上肢
  { key: "neck", label: "首", category: "upper" },
  { key: "shoulder", label: "肩", category: "upper" },
  { key: "elbow", label: "肘", category: "upper" },
  { key: "arm", label: "腕", category: "upper" },
  { key: "wrist", label: "手首", category: "upper" },
  { key: "finger", label: "指", category: "upper" },
  // 体幹
  { key: "back", label: "背中", category: "trunk" },
  { key: "lower_back", label: "腰", category: "trunk" },
  { key: "hip", label: "股関節", category: "trunk" },
  { key: "buttock", label: "臀部", category: "trunk" },
  // 下肢
  { key: "knee", label: "膝", category: "lower" },
  { key: "lower_leg", label: "下腿", category: "lower" },
  { key: "ankle", label: "足首", category: "lower" },
  // その他（自由記述）
  { key: "other", label: "その他", category: "other", freeText: true },
];

export const BODY_PART_LABEL: Record<string, string> = BODY_PARTS.reduce(
  (acc, b) => {
    acc[b.key] = b.label;
    return acc;
  },
  {} as Record<string, string>,
);

export const BODY_PART_CATEGORY_LABEL: Record<BodyPartCategory, string> = {
  upper: "上半身",
  trunk: "体幹",
  lower: "下半身",
  other: "その他",
};

export const BODY_PARTS_BY_CATEGORY: Record<BodyPartCategory, BodyPart[]> = (
  ["upper", "trunk", "lower", "other"] as const
).reduce(
  (acc, c) => {
    acc[c] = BODY_PARTS.filter((b) => b.category === c);
    return acc;
  },
  {} as Record<BodyPartCategory, BodyPart[]>,
);

// --- Pain entry (per body part) ---------------------------------------

export type PainSide = "left" | "right" | "both";

export const PAIN_SIDE_LABEL: Record<PainSide, string> = {
  left: "左",
  right: "右",
  both: "両方",
};

export type PainEntry = {
  area: string;             // body part key
  side: PainSide | null;    // optional (some parts may not need L/R)
  strength: number;         // 1..5 (5 = most severe)
  free_text?: string;       // only for area="other"
};

// Body parts where left/right doesn't apply (midline structures).
const SIDELESS_AREAS = new Set(["neck", "back", "lower_back", "buttock", "other"]);
export function bodyPartHasSide(area: string): boolean {
  return !SIDELESS_AREAS.has(area);
}

// --- Symptoms (neuro / autonomic only — pain moved to body parts) -----

export type SymptomCategory = "nerve_auto";

export type SymptomOption = {
  key: string;
  label: string;
  category: SymptomCategory;
};

export const SYMPTOM_OPTIONS: SymptomOption[] = [
  { key: "headache", label: "頭痛", category: "nerve_auto" },
  { key: "eye_fatigue", label: "眼精疲労", category: "nerve_auto" },
  { key: "insomnia", label: "不眠", category: "nerve_auto" },
  { key: "irritability", label: "イライラ", category: "nerve_auto" },
  { key: "anxiety", label: "不安", category: "nerve_auto" },
  { key: "fatigue", label: "倦怠感", category: "nerve_auto" },
  { key: "cold", label: "冷え", category: "nerve_auto" },
  { key: "hot_flash", label: "ほてり", category: "nerve_auto" },
  { key: "swelling", label: "むくみ", category: "nerve_auto" },
  { key: "gastric", label: "胃腸不調", category: "nerve_auto" },
];

export const SYMPTOM_LABEL: Record<string, string> = SYMPTOM_OPTIONS.reduce(
  (acc, s) => {
    acc[s.key] = s.label;
    return acc;
  },
  {} as Record<string, string>,
);

export const CATEGORY_LABEL: Record<SymptomCategory, string> = {
  nerve_auto: "神経・自律神経",
};

export const SYMPTOMS_BY_CATEGORY: Record<SymptomCategory, SymptomOption[]> = {
  nerve_auto: SYMPTOM_OPTIONS,
};

// Legacy keys we no longer expose in the form, but may still appear on old
// daily_log rows. Map them to a human label so historical records stay
// readable.
export const LEGACY_SYMPTOM_LABEL: Record<string, string> = {
  shoulder_stiff: "肩こり (旧)",
  neck_stiff: "首こり (旧)",
  back_pain: "腰痛 (旧)",
  joint_pain: "関節痛 (旧)",
  dizziness: "めまい (旧)",
  appetite: "食欲不振 (旧)",
  bowel: "便通の不調 (旧)",
  cold_like: "風邪っぽい (旧)",
};

export function symptomLabelFor(key: string): string {
  return SYMPTOM_LABEL[key] || LEGACY_SYMPTOM_LABEL[key] || key;
}

// --- Mood (5 levels: 絶不調 ↔ 絶好調) -----------------------------------

export type MoodOption = {
  value: number;
  label: string;
  emoji: string;
};

export const MOOD_OPTIONS: MoodOption[] = [
  { value: 1, label: "絶不調", emoji: "😣" },
  { value: 2, label: "不調", emoji: "😟" },
  { value: 3, label: "普通", emoji: "😐" },
  { value: 4, label: "好調", emoji: "🙂" },
  { value: 5, label: "絶好調", emoji: "😄" },
];

export function moodFor(value: number | null | undefined): MoodOption | null {
  if (value == null) return null;
  return MOOD_OPTIONS.find((m) => m.value === value) || null;
}

// --- Sleep options (30-minute increments, scrollable picker) ----------

export const SLEEP_HOURS_OPTIONS: number[] = (() => {
  const out: number[] = [];
  for (let h = 0; h <= 12; h++) {
    out.push(h);
    if (h < 12) out.push(h + 0.5);
  }
  return out;
})();

export function formatSleepHours(h: number | null | undefined): string {
  if (h == null) return "";
  const whole = Math.floor(h);
  const half = h - whole >= 0.5;
  return half ? `約${whole}時間30分` : `約${whole}時間`;
}
