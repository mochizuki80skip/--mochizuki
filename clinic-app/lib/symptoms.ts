// Daily log option lists. Tweak labels here when the clinic wants to change
// which symptoms are tracked — every UI surface reads from these arrays.

export type SymptomCategory = "pain" | "nerve" | "circ" | "metab" | "other";

export type SymptomOption = {
  key: string;
  label: string;
  category: SymptomCategory;
};

export const SYMPTOM_OPTIONS: SymptomOption[] = [
  // 痛み
  { key: "headache", label: "頭痛", category: "pain" },
  { key: "shoulder_stiff", label: "肩こり", category: "pain" },
  { key: "neck_stiff", label: "首こり", category: "pain" },
  { key: "back_pain", label: "腰痛", category: "pain" },
  { key: "joint_pain", label: "関節痛", category: "pain" },
  // 神経・自律神経
  { key: "insomnia", label: "不眠", category: "nerve" },
  { key: "anxiety", label: "イライラ・不安", category: "nerve" },
  { key: "dizziness", label: "めまい", category: "nerve" },
  { key: "eye_fatigue", label: "目の疲れ", category: "nerve" },
  // 循環
  { key: "cold", label: "冷え", category: "circ" },
  { key: "swelling", label: "むくみ", category: "circ" },
  // 代謝
  { key: "fatigue", label: "倦怠感", category: "metab" },
  { key: "appetite", label: "食欲不振", category: "metab" },
  { key: "bowel", label: "便通の不調", category: "metab" },
  // その他
  { key: "cold_like", label: "風邪っぽい", category: "other" },
];

export const SYMPTOM_LABEL: Record<string, string> = SYMPTOM_OPTIONS.reduce(
  (acc, s) => {
    acc[s.key] = s.label;
    return acc;
  },
  {} as Record<string, string>,
);

export const CATEGORY_LABEL: Record<SymptomCategory, string> = {
  pain: "痛み",
  nerve: "神経・自律神経",
  circ: "循環",
  metab: "代謝",
  other: "その他",
};

export const SYMPTOMS_BY_CATEGORY: Record<SymptomCategory, SymptomOption[]> = (
  ["pain", "nerve", "circ", "metab", "other"] as const
).reduce(
  (acc, c) => {
    acc[c] = SYMPTOM_OPTIONS.filter((s) => s.category === c);
    return acc;
  },
  {} as Record<SymptomCategory, SymptomOption[]>,
);

// Mood: 1 = 悪い, 5 = 良好 (matches the inverted scoring direction).
export type MoodOption = {
  value: number;
  label: string;
  emoji: string;
};

export const MOOD_OPTIONS: MoodOption[] = [
  { value: 1, label: "悪い", emoji: "😣" },
  { value: 2, label: "やや悪い", emoji: "😟" },
  { value: 3, label: "普通", emoji: "😐" },
  { value: 4, label: "良い", emoji: "🙂" },
  { value: 5, label: "良好", emoji: "😄" },
];

export function moodFor(value: number | null | undefined): MoodOption | null {
  if (value == null) return null;
  return MOOD_OPTIONS.find((m) => m.value === value) || null;
}
