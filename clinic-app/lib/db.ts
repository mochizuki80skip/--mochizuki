import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Answer,
  AxisKey,
  AxisResult,
  DailyLog,
  DiagnoseType,
  DiagnosisRow,
  Patient,
} from "./types";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are not configured");
  }
  _client = createClient(url, key, {
    auth: { persistSession: false },
  });
  return _client;
}

export async function listPatients(): Promise<Patient[]> {
  const { data, error } = await getClient()
    .from("patients")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Patient[];
}

export async function getPatientById(id: string): Promise<Patient | null> {
  const { data, error } = await getClient()
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Patient) || null;
}

export async function findPatientByChartAndName(
  chartNumber: string,
  name: string,
): Promise<Patient | null> {
  const { data, error } = await getClient()
    .from("patients")
    .select("*")
    .eq("chart_number", chartNumber)
    .eq("name", name)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Patient) || null;
}

export async function findPatientByChart(
  chartNumber: string,
): Promise<Patient | null> {
  const { data, error } = await getClient()
    .from("patients")
    .select("*")
    .eq("chart_number", chartNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Patient) || null;
}

export type CreatePatientInput = {
  chart_number: string;
  name: string;
  furigana?: string | null;
  birth_date?: string | null;
  notes?: string | null;
  clinic_id?: string | null;
};

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  const { data, error } = await getClient()
    .from("patients")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Patient;
}

export async function listDiagnosesForPatient(
  patientId: string,
): Promise<DiagnosisRow[]> {
  const { data, error } = await getClient()
    .from("diagnoses")
    .select("*")
    .eq("patient_id", patientId)
    .order("diagnosed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as DiagnosisRow[];
}

export async function getDiagnosis(id: string): Promise<DiagnosisRow | null> {
  const { data, error } = await getClient()
    .from("diagnoses")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DiagnosisRow) || null;
}

export type SaveDiagnosisInput = {
  patient_id: string | null;
  scores: Record<AxisKey, AxisResult>;
  type_key: DiagnoseType;
  answers: Answer[];
};

export async function saveDiagnosis(
  input: SaveDiagnosisInput,
): Promise<DiagnosisRow> {
  const { data, error } = await getClient()
    .from("diagnoses")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Touch patient.updated_at so the admin list can sort by recency.
  if (input.patient_id) {
    await getClient()
      .from("patients")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", input.patient_id);
  }

  return data as DiagnosisRow;
}

export async function getLatestDiagnosisDateMap(
  patientIds: string[],
): Promise<Record<string, string>> {
  if (patientIds.length === 0) return {};
  const { data, error } = await getClient()
    .from("diagnoses")
    .select("patient_id, diagnosed_at")
    .in("patient_id", patientIds)
    .order("diagnosed_at", { ascending: false });
  if (error) throw new Error(error.message);
  const map: Record<string, string> = {};
  for (const row of data || []) {
    const pid = (row as { patient_id: string }).patient_id;
    if (!map[pid]) {
      map[pid] = (row as { diagnosed_at: string }).diagnosed_at;
    }
  }
  return map;
}

export type DashboardStats = {
  totalPatients: number;
  diagnosesThisMonth: number;
  typeDistribution: Record<string, number>;
  staleCount: number;
  todaysBirthdays: Patient[];
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const sb = getClient();

  const [{ data: patients }, { data: thisMonthDiag }, { data: typeDiag }] =
    await Promise.all([
      sb.from("patients").select("*"),
      sb
        .from("diagnoses")
        .select("id, diagnosed_at, patient_id")
        .gte(
          "diagnosed_at",
          new Date(
            new Date().getFullYear(),
            new Date().getMonth(),
            1,
          ).toISOString(),
        ),
      sb.from("diagnoses").select("type_key, patient_id, diagnosed_at"),
    ]);

  const allPatients = (patients || []) as Patient[];

  // Latest diagnosis per patient for stale calculation.
  const latestMap: Record<string, number> = {};
  for (const r of typeDiag || []) {
    const row = r as { patient_id: string | null; diagnosed_at: string };
    if (!row.patient_id) continue;
    const t = new Date(row.diagnosed_at).getTime();
    if (!latestMap[row.patient_id] || latestMap[row.patient_id] < t) {
      latestMap[row.patient_id] = t;
    }
  }
  const STALE_MS = 60 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const staleCount = allPatients.filter((p) => {
    const t = latestMap[p.id];
    return !t || now - t > STALE_MS;
  }).length;

  // Type distribution: count latest diagnosis per patient.
  const latestTypeByPatient: Record<string, string> = {};
  const latestTimeByPatient: Record<string, number> = {};
  for (const r of typeDiag || []) {
    const row = r as {
      patient_id: string | null;
      type_key: string;
      diagnosed_at: string;
    };
    if (!row.patient_id) continue;
    const t = new Date(row.diagnosed_at).getTime();
    if (!latestTimeByPatient[row.patient_id] || latestTimeByPatient[row.patient_id] < t) {
      latestTimeByPatient[row.patient_id] = t;
      latestTypeByPatient[row.patient_id] = row.type_key;
    }
  }
  const typeDistribution: Record<string, number> = {};
  for (const k of Object.values(latestTypeByPatient)) {
    typeDistribution[k] = (typeDistribution[k] || 0) + 1;
  }

  // Today's birthdays (month/day match).
  const today = new Date();
  const todaysBirthdays = allPatients.filter((p) => {
    if (!p.birth_date) return false;
    const d = new Date(p.birth_date);
    if (Number.isNaN(d.getTime())) return false;
    return (
      d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
    );
  });

  return {
    totalPatients: allPatients.length,
    diagnosesThisMonth: (thisMonthDiag || []).length,
    typeDistribution,
    staleCount,
    todaysBirthdays,
  };
}

export async function updateDiagnosisNote(
  diagnosisId: string,
  note: string | null,
): Promise<void> {
  const { error } = await getClient()
    .from("diagnoses")
    .update({ staff_note: note })
    .eq("id", diagnosisId);
  if (error) throw new Error(error.message);
}

// --- Daily logs ----------------------------------------------------------

// Pages must keep rendering even if the daily_logs migration hasn't been
// applied yet, or if RLS blocks the anon key. We swallow any read-side error
// and log it so server logs still surface the cause.
function logDailyLogReadError(where: string, err: unknown) {
  // eslint-disable-next-line no-console
  console.error(`[daily_logs] read failed in ${where}:`, err);
}

// Defensive default for old rows that pre-date the pains/sleep_hours/BP columns.
function normalizeLog(row: Record<string, unknown>): DailyLog {
  return {
    id: row.id as string,
    patient_id: row.patient_id as string,
    log_date: row.log_date as string,
    mood: (row.mood as number | null) ?? null,
    sleep_quality: (row.sleep_quality as number | null) ?? null,
    sleep_hours: (row.sleep_hours as number | null) ?? null,
    bp_systolic: (row.bp_systolic as number | null) ?? null,
    bp_diastolic: (row.bp_diastolic as number | null) ?? null,
    symptoms: Array.isArray(row.symptoms) ? (row.symptoms as string[]) : [],
    pains: Array.isArray(row.pains)
      ? (row.pains as DailyLog["pains"])
      : [],
    notes: (row.notes as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getDailyLog(
  patientId: string,
  date: string,
): Promise<DailyLog | null> {
  try {
    const { data, error } = await getClient()
      .from("daily_logs")
      .select("*")
      .eq("patient_id", patientId)
      .eq("log_date", date)
      .maybeSingle();
    if (error) {
      logDailyLogReadError("getDailyLog", error);
      return null;
    }
    return data ? normalizeLog(data as Record<string, unknown>) : null;
  } catch (e) {
    logDailyLogReadError("getDailyLog (throw)", e);
    return null;
  }
}

export async function listDailyLogsForPatient(
  patientId: string,
  fromDate?: string,
  toDate?: string,
): Promise<DailyLog[]> {
  try {
    let q = getClient()
      .from("daily_logs")
      .select("*")
      .eq("patient_id", patientId)
      .order("log_date", { ascending: false });
    if (fromDate) q = q.gte("log_date", fromDate);
    if (toDate) q = q.lte("log_date", toDate);
    const { data, error } = await q;
    if (error) {
      logDailyLogReadError("listDailyLogsForPatient", error);
      return [];
    }
    return (data || []).map((r) => normalizeLog(r as Record<string, unknown>));
  } catch (e) {
    logDailyLogReadError("listDailyLogsForPatient (throw)", e);
    return [];
  }
}

export type UpsertLogInput = {
  patient_id: string;
  log_date: string;
  mood: number | null;
  sleep_quality: number | null;
  sleep_hours: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  symptoms: string[];
  pains: import("./types").PainRecord[];
  notes: string | null;
};

export async function upsertDailyLog(
  input: UpsertLogInput,
): Promise<DailyLog> {
  // Postgres unique(patient_id, log_date) lets us upsert cleanly. We pass the
  // full record so existing fields get overwritten on save (no partial merges
  // needed: the form always submits the complete state).
  const { data, error } = await getClient()
    .from("daily_logs")
    .upsert(
      {
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "patient_id,log_date" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as DailyLog;
}

export async function deleteDailyLog(
  patientId: string,
  date: string,
): Promise<void> {
  const { error } = await getClient()
    .from("daily_logs")
    .delete()
    .eq("patient_id", patientId)
    .eq("log_date", date);
  if (error) throw new Error(error.message);
}
