import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createPatient, findPatientByChart } from "@/lib/db";
import { isValidClinicId } from "@/lib/clinics";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    chart_number?: unknown;
    name?: unknown;
    furigana?: unknown;
    birth_date?: unknown;
    notes?: unknown;
    clinic_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const chart_number =
    typeof body.chart_number === "string" ? body.chart_number.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const furigana =
    typeof body.furigana === "string" && body.furigana.trim()
      ? body.furigana.trim()
      : null;
  const birth_date =
    typeof body.birth_date === "string" && body.birth_date
      ? body.birth_date
      : null;
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim()
      : null;
  const clinic_id =
    typeof body.clinic_id === "string" && isValidClinicId(body.clinic_id)
      ? body.clinic_id
      : null;

  if (!chart_number || !name) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const existing = await findPatientByChart(chart_number);
  if (existing) {
    return NextResponse.json({ error: "chart_number_taken" }, { status: 409 });
  }

  const patient = await createPatient({
    chart_number,
    name,
    furigana,
    birth_date,
    notes,
    clinic_id,
  });

  return NextResponse.json({ ok: true, id: patient.id });
}
