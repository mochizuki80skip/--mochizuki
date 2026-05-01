// ==========================================================================
// 大分類（3軸）— patient-facing radar / charts. These are the existing
// `AxisKey` slots, mapped to TCM 大分類 categories:
//   nerve = 気虚 + 気滞   (神経 / 気)
//   circ  = 血虚 + 瘀血   (循環 / 血)
//   metab = 陰虚 + 痰湿   (代謝 / 水)
// ==========================================================================

export type AxisKey = "nerve" | "circ" | "metab";

export const AXIS_LABEL: Record<AxisKey, { ja: string; en: string; role: string }> = {
  nerve: { ja: "神経", en: "Nervous", role: "気・指令" },
  circ:  { ja: "循環", en: "Circulation", role: "血・供給" },
  metab: { ja: "代謝", en: "Metabolism", role: "水・排出" },
};

// ==========================================================================
// 弁証（6軸）— staff-facing radar. Each 大分類 has 2 弁証.
// ==========================================================================

export type BenshoKey =
  | "kikyo"     // 気虚
  | "kitai"     // 気滞
  | "kekkyo"    // 血虚
  | "oketsu"    // 瘀血
  | "inkyo"     // 陰虚
  | "tanshitsu"; // 痰湿

export const BENSHO_LABEL: Record<BenshoKey, { ja: string; axis: AxisKey }> = {
  kikyo:     { ja: "気虚",  axis: "nerve" },
  kitai:     { ja: "気滞",  axis: "nerve" },
  kekkyo:    { ja: "血虚",  axis: "circ"  },
  oketsu:    { ja: "瘀血",  axis: "circ"  },
  inkyo:     { ja: "陰虚",  axis: "metab" },
  tanshitsu: { ja: "痰湿",  axis: "metab" },
};

export const BENSHO_FOR_AXIS: Record<AxisKey, [BenshoKey, BenshoKey]> = {
  nerve: ["kikyo",  "kitai"],
  circ:  ["kekkyo", "oketsu"],
  metab: ["inkyo",  "tanshitsu"],
};

export type BenshoResult = {
  key: BenshoKey;
  /** Sum of 3 questions, 0..9 (high = strong tendency) */
  raw: number;
  /** 0..100, high = strong tendency (TCM-staff convention) */
  normalized: number;
};

// ==========================================================================
// Question / Answer
// ==========================================================================

export type Question = {
  id: string;
  /** 大分類 — used for radar grouping & legacy axis filters */
  axis: AxisKey;
  /** 弁証 — finer-grained category, used for treatment selection */
  bensho: BenshoKey;
  text: string;
  hint?: string;
};

export type Answer = {
  id: string;
  /** 0..3 (まったくない / たまにある / よくある / ほぼいつもある) */
  value: number;
};

// ==========================================================================
// 大分類 result (patient radar). Score direction is INVERTED:
//   high `normalized` = healthier
//   low  `normalized` = more symptomatic
// This keeps the patient-facing radar/trend semantics consistent with the
// original 3-axis system.
// ==========================================================================

export type AxisLevel = "balanced" | "mild" | "off" | "strong";

export type AxisResult = {
  axis: AxisKey;
  /** Sum of 6 underlying question scores, 0..18 (high = more symptomatic) */
  raw: number;
  /** 0..100, INVERTED: high = healthy */
  normalized: number;
  level: AxisLevel;
};

// ==========================================================================
// Treatment plan (staff)
// ==========================================================================

export type TreatmentEntry = {
  axis: AxisKey;
  bensho: BenshoKey;
  /** 治法 — e.g. "補気・補益" */
  chiho: string;
  /** 経穴 — 4 acupoints from the master */
  points: string[];
  /** 大分類 raw (0..18) at time of diagnosis, used for ranking */
  axisScore: number;
};

export type TreatmentSessions = {
  first: string;
  second: string;
  third: string;
};

export type TreatmentPlan = {
  /** 大分類 ranked by raw desc, with the dominant 弁証 selected per group */
  priority: TreatmentEntry[];
  /** Per-session message templates (currently shared across all patterns) */
  sessions: TreatmentSessions;
};

// ==========================================================================
// Diagnosis result
// ==========================================================================

export type DiagnoseType =
  | "balanced"
  | "nerve_excess"
  | "circ_deficit"
  | "metab_low"
  | "compound";

/**
 * Stored shape of `diagnoses.scores` jsonb. Old rows only contain the 3
 * 大分類 keys; new rows additionally carry 6-弁証 scores and a treatment plan.
 */
export type DiagnosisScores = {
  nerve: AxisResult;
  circ: AxisResult;
  metab: AxisResult;
  bensho?: Record<BenshoKey, BenshoResult>;
  treatment?: TreatmentPlan;
};

export type DiagnoseResult = {
  axes: Record<AxisKey, AxisResult>;
  bensho?: Record<BenshoKey, BenshoResult>;
  treatment?: TreatmentPlan;
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
  scores: DiagnosisScores;
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

export type Visit = {
  id: string;
  patient_id: string;
  visit_date: string;     // YYYY-MM-DD
  recorded_by: "patient" | "staff";
  note: string | null;
  created_at: string;
};

export type PainRecord = {
  area: string;
  side: "left" | "right" | "both" | null;
  strength: number; // 1..5
  free_text?: string | null;
};

// ==========================================================================
// 鍼灸カルテ (chart_records / chart_comments)
// ==========================================================================

export type ChartView = "front" | "back";
export type ChartLayer = "skeleton" | "muscle";
export type ChartMarkerType =
  | "needle"   // 鍼 (赤針)
  | "intra"    // 円皮鍼 (青丸)
  | "moxa"     // 灸 (紫四角)
  | "manual"   // 手技 (緑手)
  | "muscle"   // 筋肉調整 (オレンジバンド + 部位選択)
  | "skeletal"; // 骨格矯正 (グレーひし形 + 部位選択)

export type ChartMarker = {
  /** 一意ID — クライアント側で付与 (UUIDでなくとも良い) */
  id: string;
  view: ChartView;
  /** SVGの 0..100 座標 (%) */
  x: number;
  y: number;
  type: ChartMarkerType;
  /** "muscle"/"skeletal" のときのみ — 部位名 (例: "僧帽筋", "頸椎") */
  part?: string | null;
  /** 任意メモ */
  note?: string | null;
};

export type ChartRecord = {
  id: string;
  visit_id: string;
  patient_id: string;
  recorded_by: "master" | "main" | "branch";
  markers: ChartMarker[];
  free_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ChartComment = {
  id: string;
  chart_id: string;
  author_role: "master" | "main" | "branch";
  body: string;
  created_at: string;
  updated_at: string;
};
