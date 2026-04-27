import { NextResponse } from "next/server";
import { getAuthenticatedPatientId } from "@/lib/auth";
import {
  deleteDailyLog,
  getDailyLog,
  upsertDailyLog,
} from "@/lib/db";
import { SYMPTOM_OPTIONS } from "@/lib/symptoms";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_KEYS = new Set(SYMPTOM_OPTIONS.map((s) => s.key));

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  // Reject future-dated logs to prevent accidental misclicks.
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return s <= todayKey;
}

function sanitizeMood(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= 1 && n <= 5 ? n : null;
}

function sanitizeSymptoms(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    if (!VALID_KEYS.has(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export async function GET(
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
  const log = await getDailyLog(patientId, params.date);
  return NextResponse.json({ ok: true, log });
}

export async function PUT(
  req: Request,
  { params }: { params: { date: string } },
) {
  const patientId = getAuthenticatedPatientId();
  if (!patientId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isValidDate(params.date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  let body: {
    mood?: unknown;
    sleep_quality?: unknown;
    symptoms?: unknown;
    notes?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const mood = sanitizeMood(body.mood);
  const sleep = sanitizeMood(body.sleep_quality);
  const symptoms = sanitizeSymptoms(body.symptoms);
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim().slice(0, 2000)
      : null;

  // If everything is empty, treat the request as a delete so the calendar
  // doesn't show a dot for an effectively blank record.
  const isEmpty =
    mood == null && sleep == null && symptoms.length === 0 && !notes;
  if (isEmpty) {
    await deleteDailyLog(patientId, params.date);
    return NextResponse.json({ ok: true, deleted: true });
  }

  const log = await upsertDailyLog({
    patient_id: patientId,
    log_date: params.date,
    mood,
    sleep_quality: sleep,
    symptoms,
    notes,
  });

  return NextResponse.json({ ok: true, log });
}
