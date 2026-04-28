import { contentForType } from "./content";
import { BODY_PART_LABEL, PAIN_SIDE_LABEL, moodFor, symptomLabelFor } from "./symptoms";
import type {
  AxisKey,
  DailyLog,
  DiagnosisRow,
  Patient,
  Visit,
} from "./types";

// --- Period definition ----------------------------------------------------

export type AnalysisPeriod = {
  from: string; // YYYY-MM-DD inclusive
  to: string;   // YYYY-MM-DD inclusive
};

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function daysBetweenInclusive(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

// --- Treatment categories (the rule table the senior practitioner can tweak) -

export type TreatmentCategoryKey =
  | "autonomic"
  | "circulation"
  | "trigger"
  | "metabolism";

export type TreatmentCategory = {
  key: TreatmentCategoryKey;
  emoji: string;
  name: string;
  approach: string;
  /** Symptom keys that count toward this category. */
  symptoms: string[];
  /** Pain area keys that count toward this category (e.g. trigger covers pains). */
  painAreas?: string[];
};

export const TREATMENT_CATEGORIES: TreatmentCategory[] = [
  {
    key: "autonomic",
    emoji: "🧠",
    name: "自律神経調整",
    approach: "頸部・後頭部・百会など、自律神経系のツボを中心に整える",
    symptoms: ["headache", "insomnia", "irritability", "anxiety", "hot_flash", "eye_fatigue"],
  },
  {
    key: "circulation",
    emoji: "🩸",
    name: "循環改善",
    approach: "末梢循環の改善、温熱療法、下肢中心のアプローチ",
    symptoms: ["cold", "swelling"],
  },
  {
    key: "trigger",
    emoji: "💪",
    name: "局所トリガー",
    approach: "硬結・圧痛点へのアプローチ、全身バランスも併用",
    symptoms: [],
    painAreas: [
      "neck",
      "shoulder",
      "elbow",
      "arm",
      "wrist",
      "finger",
      "back",
      "lower_back",
      "hip",
      "buttock",
      "knee",
      "lower_leg",
      "ankle",
    ],
  },
  {
    key: "metabolism",
    emoji: "🌿",
    name: "内臓・代謝",
    approach: "腹部・腰背部、内臓調整系のアプローチ",
    symptoms: ["fatigue", "gastric"],
  },
];

// --- Aggregation result ---------------------------------------------------

export type PainStat = {
  area: string;
  side: string | null;
  label: string;
  count: number;
  avgStrength: number;
  maxStrength: number;
};

export type SymptomStat = {
  key: string;
  label: string;
  count: number;
};

export type MoodSummary = {
  avg: number | null;
  trend: "up" | "down" | "flat" | null;
  distribution: Record<number, number>;
};

export type DiagnoseDelta = {
  from: DiagnosisRow;
  to: DiagnosisRow;
  axes: Record<AxisKey, { from: number; to: number; delta: number }>;
  overallFrom: number;
  overallTo: number;
  overallDelta: number;
};

export type AnalysisResult = {
  period: AnalysisPeriod & { days: number };
  counts: { logs: number; visits: number; diagnoses: number };
  mood: MoodSummary;
  sleep: { avg: number | null };
  bp: { systolic: number | null; diastolic: number | null };
  pains: PainStat[];
  symptoms: SymptomStat[];
  treatmentSuggestion: {
    categories: TreatmentCategory[];
    primaryKey: TreatmentCategoryKey | null;
    reason: string;
    isCompound: boolean;
  };
  diagnoseDelta: DiagnoseDelta | null;
  copyText: string;
};

// --- Aggregation logic ----------------------------------------------------

function inPeriod(date: string, p: AnalysisPeriod): boolean {
  return date >= p.from && date <= p.to;
}

/**
 * Aggregate pain entries from a list of daily logs into per-(area,side)
 * stats. Reused both by analyzePatient and direct callers (e.g. the patient
 * mypage which only needs pain stats for the body map).
 */
export function aggregatePainsForLogs(
  logs: DailyLog[],
  fromDate: string,
  toDate: string,
): PainStat[] {
  const period: AnalysisPeriod = { from: fromDate, to: toDate };
  const filtered = logs.filter((l) => inPeriod(l.log_date, period));
  const map = new Map<
    string,
    PainStat & { sumStrength: number }
  >();
  for (const l of filtered) {
    for (const p of l.pains || []) {
      const key = `${p.area}:${p.side ?? ""}`;
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        existing.sumStrength += p.strength;
        if (p.strength > existing.maxStrength) {
          existing.maxStrength = p.strength;
        }
      } else {
        map.set(key, {
          area: p.area,
          side: p.side,
          label: painLabel(p.area, p.side),
          count: 1,
          avgStrength: 0,
          maxStrength: p.strength,
          sumStrength: p.strength,
        });
      }
    }
  }
  return Array.from(map.values())
    .map((p) => ({
      area: p.area,
      side: p.side,
      label: p.label,
      count: p.count,
      avgStrength: Math.round((p.sumStrength / p.count) * 10) / 10,
      maxStrength: p.maxStrength,
    }))
    .sort((a, b) => b.count - a.count);
}

function moodTrend(logs: DailyLog[]): "up" | "down" | "flat" | null {
  // Compare the average of the first half to the second half. Skips logs with
  // no mood. Returns null when there isn't enough data on one side.
  const ordered = [...logs]
    .filter((l) => l.mood != null)
    .sort((a, b) => a.log_date.localeCompare(b.log_date));
  if (ordered.length < 4) return null;
  const mid = Math.floor(ordered.length / 2);
  const avg = (arr: DailyLog[]) =>
    arr.reduce((s, l) => s + (l.mood as number), 0) / arr.length;
  const a = avg(ordered.slice(0, mid));
  const b = avg(ordered.slice(mid));
  const diff = b - a;
  if (diff > 0.4) return "up";
  if (diff < -0.4) return "down";
  return "flat";
}

function painLabel(area: string, side: string | null): string {
  const base = BODY_PART_LABEL[area] || area;
  if (!side) return base;
  return `${PAIN_SIDE_LABEL[side as keyof typeof PAIN_SIDE_LABEL] || ""}${base}`;
}

function pickRecommendation(
  pains: PainStat[],
  symptoms: SymptomStat[],
  totalDays: number,
): {
  categories: TreatmentCategory[];
  primaryKey: TreatmentCategoryKey | null;
  reason: string;
  isCompound: boolean;
} {
  // Score each category by how many "frequent" inputs it covers.
  // "Frequent" = appears on at least 30% of the period (or 3 days, whichever
  // is smaller — short periods need a lower bar).
  const threshold = Math.max(2, Math.ceil(totalDays * 0.3));
  const symptomCount = (k: string) =>
    symptoms.find((s) => s.key === k)?.count ?? 0;
  const painCountForArea = (a: string) =>
    pains
      .filter((p) => p.area === a)
      .reduce((sum, p) => sum + p.count, 0);

  const scores = TREATMENT_CATEGORIES.map((c) => {
    let frequent = 0;
    const reasonItems: string[] = [];
    for (const s of c.symptoms) {
      const n = symptomCount(s);
      if (n >= threshold) {
        frequent++;
        reasonItems.push(`${symptomLabelFor(s)}${n}日`);
      }
    }
    for (const a of c.painAreas || []) {
      const n = painCountForArea(a);
      if (n >= threshold) {
        frequent++;
        reasonItems.push(`${BODY_PART_LABEL[a] || a}${n}日`);
      }
    }
    return { category: c, frequent, reasonItems };
  });

  const triggered = scores.filter((s) => s.frequent >= 1);
  triggered.sort((a, b) => b.frequent - a.frequent);

  if (triggered.length === 0) {
    return {
      categories: [],
      primaryKey: null,
      reason: "頻出する症状・痛みは特になし。バランス調整中心の施術が推奨されます。",
      isCompound: false,
    };
  }

  const isCompound = triggered.length >= 2;
  const top = triggered.slice(0, isCompound ? 2 : 1);
  const reason = top
    .map((t) => `${t.category.name}: ${t.reasonItems.slice(0, 3).join(" / ")}`)
    .join(" + ");

  return {
    categories: top.map((t) => t.category),
    primaryKey: top[0].category.key,
    reason,
    isCompound,
  };
}

function buildDiagnoseDelta(
  diagnoses: DiagnosisRow[],
): DiagnoseDelta | null {
  if (diagnoses.length < 2) return null;
  // Diagnoses are listed with most recent first elsewhere; sort here too to
  // be defensive.
  const sorted = [...diagnoses].sort(
    (a, b) =>
      new Date(a.diagnosed_at).getTime() -
      new Date(b.diagnosed_at).getTime(),
  );
  const from = sorted[0];
  const to = sorted[sorted.length - 1];
  const axes: Record<AxisKey, { from: number; to: number; delta: number }> = {
    nerve: { from: from.scores.nerve.normalized, to: to.scores.nerve.normalized, delta: 0 },
    circ: { from: from.scores.circ.normalized, to: to.scores.circ.normalized, delta: 0 },
    metab: { from: from.scores.metab.normalized, to: to.scores.metab.normalized, delta: 0 },
  };
  axes.nerve.delta = axes.nerve.to - axes.nerve.from;
  axes.circ.delta = axes.circ.to - axes.circ.from;
  axes.metab.delta = axes.metab.to - axes.metab.from;
  const overallFrom = Math.round(
    (from.scores.nerve.normalized + from.scores.circ.normalized + from.scores.metab.normalized) / 3,
  );
  const overallTo = Math.round(
    (to.scores.nerve.normalized + to.scores.circ.normalized + to.scores.metab.normalized) / 3,
  );
  return {
    from,
    to,
    axes,
    overallFrom,
    overallTo,
    overallDelta: overallTo - overallFrom,
  };
}

function avgOrNull(values: (number | null | undefined)[]): number | null {
  const filtered = values.filter((v): v is number => typeof v === "number");
  if (filtered.length === 0) return null;
  const sum = filtered.reduce((a, b) => a + b, 0);
  return sum / filtered.length;
}

export function analyzePatient(opts: {
  patient: Patient;
  period: AnalysisPeriod;
  logs: DailyLog[];
  visits: Visit[];
  diagnoses: DiagnosisRow[];
}): AnalysisResult {
  const { period } = opts;
  const days = Math.max(1, daysBetweenInclusive(period.from, period.to));

  const logs = opts.logs.filter((l) => inPeriod(l.log_date, period));
  const visits = opts.visits.filter((v) => inPeriod(v.visit_date, period));
  const diagnoses = opts.diagnoses.filter((d) =>
    inPeriod(d.diagnosed_at.slice(0, 10), period),
  );

  // Mood
  const moodValues = logs.map((l) => l.mood);
  const moodAvg = avgOrNull(moodValues);
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const v of moodValues) {
    if (typeof v === "number" && distribution[v] != null) distribution[v]++;
  }
  const mood: MoodSummary = {
    avg: moodAvg == null ? null : Math.round(moodAvg * 10) / 10,
    trend: moodTrend(logs),
    distribution,
  };

  // Sleep
  const sleepAvg = avgOrNull(logs.map((l) => l.sleep_hours));
  const sleep = {
    avg: sleepAvg == null ? null : Math.round(sleepAvg * 10) / 10,
  };

  // BP
  const bpSys = avgOrNull(logs.map((l) => l.bp_systolic));
  const bpDia = avgOrNull(logs.map((l) => l.bp_diastolic));
  const bp = {
    systolic: bpSys == null ? null : Math.round(bpSys),
    diastolic: bpDia == null ? null : Math.round(bpDia),
  };

  // Pains aggregated by area+side (shared logic with patient mypage).
  const pains = aggregatePainsForLogs(logs, period.from, period.to);

  // Symptoms aggregated by key
  const symptomMap = new Map<string, number>();
  for (const l of logs) {
    for (const s of l.symptoms || []) {
      symptomMap.set(s, (symptomMap.get(s) || 0) + 1);
    }
  }
  const symptoms: SymptomStat[] = Array.from(symptomMap.entries())
    .map(([key, count]) => ({ key, label: symptomLabelFor(key), count }))
    .sort((a, b) => b.count - a.count);

  const treatmentSuggestion = pickRecommendation(pains, symptoms, days);

  const diagnoseDelta = buildDiagnoseDelta(diagnoses);

  // Build a copy-pasta summary text staff can drop into LINE / clinic notes.
  const lines: string[] = [];
  lines.push(`【${opts.patient.name} 様 / ${period.from} 〜 ${period.to}】`);
  lines.push(
    `記録 ${logs.length}日 / 来院 ${visits.length}回 / 診断 ${diagnoses.length}回`,
  );

  const moodLabel = mood.avg != null ? moodFor(Math.round(mood.avg))?.label : null;
  if (mood.avg != null) {
    const trendText =
      mood.trend === "up"
        ? "改善傾向"
        : mood.trend === "down"
        ? "悪化傾向"
        : mood.trend === "flat"
        ? "横ばい"
        : "";
    lines.push(
      `[体調] 気分平均 ${mood.avg}/5 (${moodLabel || ""}${trendText ? "・" + trendText : ""})${
        sleep.avg != null ? ` / 睡眠 ${sleep.avg}h` : ""
      }${
        bp.systolic != null && bp.diastolic != null
          ? ` / 血圧 ${bp.systolic}/${bp.diastolic}`
          : ""
      }`,
    );
  } else if (sleep.avg != null) {
    lines.push(`[体調] 睡眠 ${sleep.avg}h`);
  }

  if (pains.length > 0) {
    const top = pains.slice(0, 3).map(
      (p) => `${p.label} ${p.count}日(強度${p.avgStrength})`,
    );
    lines.push(`[痛み] ${top.join(" / ")}`);
  }
  if (symptoms.length > 0) {
    const top = symptoms.slice(0, 3).map((s) => `${s.label} ${s.count}日`);
    lines.push(`[症状] ${top.join(" / ")}`);
  }

  if (treatmentSuggestion.categories.length > 0) {
    const names = treatmentSuggestion.categories.map((c) => c.name).join(" × ");
    lines.push(`[推奨] ${names}`);
  } else {
    lines.push(`[推奨] 特定カテゴリの偏りなし。バランス調整推奨`);
  }

  if (diagnoseDelta) {
    const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);
    lines.push(
      `[診断変化] 体質スコア ${diagnoseDelta.overallFrom} → ${diagnoseDelta.overallTo} (${sign(diagnoseDelta.overallDelta)})`,
    );
    lines.push(
      `  神経 ${sign(diagnoseDelta.axes.nerve.delta)} / 循環 ${sign(diagnoseDelta.axes.circ.delta)} / 代謝 ${sign(diagnoseDelta.axes.metab.delta)}`,
    );
    lines.push(`  最新タイプ: ${contentForType(diagnoseDelta.to.type_key).name}`);
  }

  // Append patient memos if there are any.
  const notedLogs = logs.filter((l) => l.notes && l.notes.trim()).slice(0, 3);
  if (notedLogs.length > 0) {
    lines.push(`[特記]`);
    for (const l of notedLogs) {
      lines.push(`  ${l.log_date}: ${l.notes!.trim().slice(0, 60)}`);
    }
  }

  return {
    period: { ...period, days },
    counts: { logs: logs.length, visits: visits.length, diagnoses: diagnoses.length },
    mood,
    sleep,
    bp,
    pains,
    symptoms,
    treatmentSuggestion,
    diagnoseDelta,
    copyText: lines.join("\n"),
  };
}
