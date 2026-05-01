import { NextResponse } from "next/server";
import { saveDiagnosis } from "@/lib/db";
import { getAuthenticatedPatientId, isAdminAuthenticated } from "@/lib/auth";
import type { Answer, DiagnoseType, DiagnosisScores } from "@/lib/types";

export const runtime = "nodejs";

const TYPE_KEYS: DiagnoseType[] = [
  "balanced",
  "nerve_excess",
  "circ_deficit",
  "metab_low",
  "compound",
];

function isValidScores(s: unknown): s is DiagnosisScores {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return ["nerve", "circ", "metab"].every((k) => {
    const v = o[k] as { normalized?: unknown } | undefined;
    return v && typeof v === "object" && typeof v.normalized === "number";
  });
}

export async function POST(req: Request) {
  let body: {
    scores?: unknown;
    type_key?: unknown;
    answers?: unknown;
    patient_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!isValidScores(body.scores)) {
    return NextResponse.json({ error: "invalid_scores" }, { status: 400 });
  }
  if (
    typeof body.type_key !== "string" ||
    !TYPE_KEYS.includes(body.type_key as DiagnoseType)
  ) {
    return NextResponse.json({ error: "invalid_type_key" }, { status: 400 });
  }

  // Patient context: prefer cookie (patient self-flow), then admin-supplied id.
  const patientCookieId = getAuthenticatedPatientId();
  const isAdmin = isAdminAuthenticated();
  let patientId: string | null = patientCookieId;
  if (!patientId && isAdmin && typeof body.patient_id === "string") {
    patientId = body.patient_id;
  }

  // The diagnosis was performed by the patient if their cookie is what
  // identified them; otherwise (admin-supplied id) the staff ran it on the
  // patient's behalf. The result page uses this to send the user back to the
  // right place: own マイページ vs admin patient management.
  const role: "patient" | "admin" | null = patientCookieId
    ? "patient"
    : isAdmin
    ? "admin"
    : null;

  // Phase 2A only persists diagnoses tied to a patient. Anonymous trial flows
  // stay client-side until we explicitly add anonymous tracking.
  if (!patientId) {
    return NextResponse.json({ ok: true, saved: false, role });
  }

  const row = await saveDiagnosis({
    patient_id: patientId,
    scores: body.scores as DiagnosisScores,
    type_key: body.type_key as DiagnoseType,
    answers: Array.isArray(body.answers) ? (body.answers as Answer[]) : [],
  });

  return NextResponse.json({ ok: true, saved: true, id: row.id, role, patient_id: patientId });
}
