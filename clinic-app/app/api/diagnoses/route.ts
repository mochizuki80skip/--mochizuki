import { NextResponse } from "next/server";
import { saveDiagnosis } from "@/lib/db";
import { getAuthenticatedPatientId, isAdminAuthenticated } from "@/lib/auth";
import type { Answer, AxisKey, AxisResult, DiagnoseType } from "@/lib/types";

export const runtime = "nodejs";

const TYPE_KEYS: DiagnoseType[] = [
  "balanced",
  "nerve_excess",
  "circ_deficit",
  "metab_low",
  "compound",
];

function isValidScores(s: unknown): s is Record<AxisKey, AxisResult> {
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
  let patientId: string | null = getAuthenticatedPatientId();
  if (!patientId && isAdminAuthenticated() && typeof body.patient_id === "string") {
    patientId = body.patient_id;
  }

  // Phase 2A only persists diagnoses tied to a patient. Anonymous trial flows
  // stay client-side until we explicitly add anonymous tracking.
  if (!patientId) {
    return NextResponse.json({ ok: true, saved: false });
  }

  const row = await saveDiagnosis({
    patient_id: patientId,
    scores: body.scores as Record<AxisKey, AxisResult>,
    type_key: body.type_key as DiagnoseType,
    answers: Array.isArray(body.answers) ? (body.answers as Answer[]) : [],
  });

  return NextResponse.json({ ok: true, saved: true, id: row.id });
}
