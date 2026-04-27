import { NextResponse } from "next/server";
import { canAccessPatient, getAdminContext } from "@/lib/guards";
import {
  getDiagnosis,
  getPatientById,
  updateDiagnosisNote,
} from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = getAdminContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Ownership check via the parent patient.
  const diag = await getDiagnosis(params.id);
  if (!diag || !diag.patient_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const patient = await getPatientById(diag.patient_id);
  if (!canAccessPatient(patient, ctx)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { staff_note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!("staff_note" in body)) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }
  const note =
    typeof body.staff_note === "string"
      ? body.staff_note.trim() || null
      : null;

  try {
    await updateDiagnosisNote(params.id, note);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
