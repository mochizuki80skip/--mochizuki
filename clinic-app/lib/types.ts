export type AxisKey = "nerve" | "circ" | "metab";

export const AXIS_LABEL: Record<AxisKey, { ja: string; en: string; role: string }> = {
  nerve: { ja: "神経", en: "Nervous", role: "指令" },
  circ:  { ja: "循環", en: "Circulation", role: "供給" },
  metab: { ja: "代謝", en: "Metabolism", role: "排出" },
};

export type Question = {
  id: string;
  axis: AxisKey;
  text: string;
  hint?: string;
};

export type Answer = {
  id: string;
  value: number; // 1..5
};

export type AxisLevel = "balanced" | "mild" | "off" | "strong";

export type AxisResult = {
  axis: AxisKey;
  raw: number;          // sum of 5 questions, 5..25
  normalized: number;   // 0..100
  level: AxisLevel;
};

export type DiagnoseType =
  | "balanced"
  | "nerve_excess"
  | "circ_deficit"
  | "metab_low"
  | "compound";

export type DiagnoseResult = {
  axes: Record<AxisKey, AxisResult>;
  type: DiagnoseType;
  primary: AxisKey | null;
  secondary: AxisKey | null;
  createdAt: string;    // ISO
};

// --- Phase 2: persistence -------------------------------------------------

export type Patient = {
  id: string;
  chart_number: string;
  name: string;
  furigana: string | null;
  birth_date: string | null;
  notes: string | null;
  /** Identifier of the clinic this patient primarily attends. */
  clinic_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DiagnosisRow = {
  id: string;
  patient_id: string | null;
  scores: Record<AxisKey, AxisResult>;
  type_key: DiagnoseType;
  answers: Answer[] | null;
  diagnosed_at: string;
  staff_note: string | null;
};

export type DailyLog = {
  id: string;
  patient_id: string;
  log_date: string;       // YYYY-MM-DD
  mood: number | null;    // 1..5 (5 = best)
  sleep_quality: number | null; // 1..5 (5 = best) — legacy
  sleep_hours: number | null;   // 0..14 in 0.5 increments
  bp_systolic: number | null;   // mmHg
  bp_diastolic: number | null;  // mmHg
  symptoms: string[];           // neuro/autonomic symptom keys
  pains: PainRecord[];          // body part pain entries
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PainRecord = {
  area: string;
  side: "left" | "right" | "both" | null;
  strength: number; // 1..5
  free_text?: string | null;
};
