import type { Answer, DiagnoseResult } from "./types";

const KEY_ANSWERS = "kc:answers";
const KEY_RESULT = "kc:result";
const KEY_PATIENT_CONTEXT = "kc:patient_id";
const KEY_RESULT_SAVED = "kc:result_saved";

export function saveAnswers(answers: Answer[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY_ANSWERS, JSON.stringify(answers));
}

export function loadAnswers(): Answer[] | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY_ANSWERS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Answer[];
  } catch {
    return null;
  }
}

export function saveResult(result: DiagnoseResult) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY_RESULT, JSON.stringify(result));
  sessionStorage.removeItem(KEY_RESULT_SAVED);
}

export function loadResult(): DiagnoseResult | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY_RESULT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DiagnoseResult;
  } catch {
    return null;
  }
}

export function setPatientContext(patientId: string | null) {
  if (typeof window === "undefined") return;
  if (patientId) {
    sessionStorage.setItem(KEY_PATIENT_CONTEXT, patientId);
  } else {
    sessionStorage.removeItem(KEY_PATIENT_CONTEXT);
  }
}

export function getPatientContext(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY_PATIENT_CONTEXT);
}

export function markResultSaved() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY_RESULT_SAVED, "1");
}

export function isResultSaved(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KEY_RESULT_SAVED) === "1";
}

export function clearDiagnose() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY_ANSWERS);
  sessionStorage.removeItem(KEY_RESULT);
  sessionStorage.removeItem(KEY_RESULT_SAVED);
  // Note: patient context is intentionally NOT cleared here so subsequent
  // diagnoses for the same patient session keep working.
}
