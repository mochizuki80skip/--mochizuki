import { NextResponse } from "next/server";
import { getAuthenticatedPatientId } from "@/lib/auth";
import { batchUpdateVisits } from "@/lib/db";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function sanitizeDates(v: unknown, today: string): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const d of v) {
    if (typeof d !== "string") continue;
    if (!DATE_RE.test(d)) continue;
    if (d > today) continue; // reject future dates
    if (seen.has(d)) continue;
    seen.add(d);
    out.push(d);
  }
  return out;
}

export async function POST(req: Request) {
  const patientId = getAuthenticatedPatientId();
  if (!patientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { added?: unknown; removed?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const today = todayKey();
  const added = sanitizeDates(body.added, today);
  const removed = sanitizeDates(body.removed, today);
  const result = await batchUpdateVisits({
    patientId,
    added,
    removed,
    recordedBy: "patient",
  });
  return NextResponse.json({ ok: true, ...result });
}
