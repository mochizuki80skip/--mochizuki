import { NextResponse } from "next/server";
import { getAuthenticatedPatientId } from "@/lib/auth";
import { createVisit } from "@/lib/db";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(req: Request) {
  const patientId = getAuthenticatedPatientId();
  if (!patientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { visit_date?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Default to today, but accept an explicit YYYY-MM-DD if patients want to
  // record a visit they forgot. Reject future dates so no accidental clicks
  // create a visit on a day that hasn't happened.
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
    patient_id: patientId,
    visit_date: date,
    recorded_by: "patient",
    note,
  });
  return NextResponse.json({ ok: true, visit });
}
