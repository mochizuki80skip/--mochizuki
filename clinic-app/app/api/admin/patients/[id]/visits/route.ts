import { NextResponse } from "next/server";
import { canAccessPatient, getAdminContext } from "@/lib/guards";
import { createVisit, getPatientById } from "@/lib/db";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = getAdminContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const patient = await getPatientById(params.id);
  if (!patient) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!canAccessPatient(patient, ctx)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { visit_date?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const today = todayKey();
  const date =
    typeof body.visit_date === "string" && DATE_RE.test(body.visit_date)
      ? body.visit_date
      : today;
  if (date > today) {
    return NextResponse.json({ error: "future_date" }, { status: 400 });
  }

  const note =
    typeof body.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 500)
      : null;

  const visit = await createVisit({
    patient_id: patient.id,
    visit_date: date,
    recorded_by: "staff",
    note,
  });
  return NextResponse.json({ ok: true, visit });
}
