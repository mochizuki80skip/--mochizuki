import type { Answer, DiagnoseResult } from "./types";

const KEY_ANSWERS = "kc:answers";
const KEY_RESULT = "kc:result";

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

export function clearDiagnose() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY_ANSWERS);
  sessionStorage.removeItem(KEY_RESULT);
}
