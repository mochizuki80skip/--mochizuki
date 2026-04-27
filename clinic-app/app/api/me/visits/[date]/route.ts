import { NextResponse } from "next/server";
import { getAuthenticatedPatientId } from "@/lib/auth";
import { deleteVisit } from "@/lib/db";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function DELETE(
  _req: Request,
  { params }: { params: { date: string } },
) {
  const patientId = getAuthenticatedPatientId();
  if (!patientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!DATE_RE.test(params.date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  await deleteVisit(patientId, params.date);
  return NextResponse.json({ ok: true });
}
