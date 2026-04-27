import { NextResponse } from "next/server";
import { canAccessPatient, getAdminContext } from "@/lib/guards";
import { deleteVisit, getPatientById } from "@/lib/db";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; date: string } },
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
  if (!DATE_RE.test(params.date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  await deleteVisit(patient.id, params.date);
  return NextResponse.json({ ok: true });
}
