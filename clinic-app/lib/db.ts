import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Answer,
  AxisKey,
  AxisResult,
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
