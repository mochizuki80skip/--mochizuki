import { NextResponse } from "next/server";
import { findPatientByChartAndName } from "@/lib/db";
import { setPatientCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let chartNumber = "";
  let name = "";
  try {
    const body = await req.json();
    chartNumber = typeof body?.chart_number === "string" ? body.chart_number.trim() : "";
    name = typeof body?.name === "string" ? body.name.trim() : "";
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!chartNumber || !name) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const patient = await findPatientByChartAndName(chartNumber, name);
  if (!patient) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  setPatientCookie(patient.id);
  return NextResponse.json({
    ok: true,
    chart_number: patient.chart_number,
  });
}
