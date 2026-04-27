import { NextResponse } from "next/server";
import { getAuthenticatedPatientId } from "@/lib/auth";
import {
  deleteDailyLog,
  getDailyLog,
  upsertDailyLog,
} from "@/lib/db";
import {
  BODY_PARTS,
  SYMPTOM_OPTIONS,
  bodyPartHasSide,
} from "@/lib/symptoms";
import type { PainRecord } from "@/lib/types";

export const runtime = "nodejs";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SYMPTOMS = new Set(SYMPTOM_OPTIONS.map((s) => s.key));
const VALID_AREAS = new Set(BODY_PARTS.map((b) => b.key));
const VALID_SIDES = new Set(["left", "right", "both"]);

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return s <= todayKey;
}

function sanitizeMood(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= 1 && n <= 5 ? n : null;
}

function sanitizeSymptoms(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    if (!VALID_SYMPTOMS.has(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function sanitizeSleepHours(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  // 0..14 in 0.5 steps; round to nearest half hour for storage hygiene.
  const half = Math.round(v * 2) / 2;
  return half >= 0 && half <= 14 ? half : null;
}

function sanitizeBp(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= 30 && n <= 260 ? n : null;
}

function sanitizePains(v: unknown): PainRecord[] {
  if (!Array.isArray(v)) return [];
  const out: PainRecord[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.area !== "string" || !VALID_AREAS.has(r.area)) continue;
    const strength =
      typeof r.strength === "number" && Number.isFinite(r.strength)
        ? Math.round(r.strength)
        : 0;
    if (strength < 1 || strength > 5) continue;
    let side: PainRecord["side"] = null;
    if (typeof r.side === "string" && VALID_SIDES.has(r.side)) {
      side = r.side as PainRecord["side"];
    }
    if (!bodyPartHasSide(r.area)) side = null;
    const free_text =
      r.area === "other" && typeof r.free_text === "string"
        ? r.free_text.trim().slice(0, 200) || null
        : null;
    out.push({ area: r.area, side, strength, free_text });
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const mood = sanitizeMood(body.mood);
  const sleep_quality = sanitizeMood(body.sleep_quality); // legacy
  const sleep_hours = sanitizeSleepHours(body.sleep_hours);
  const bp_systolic = sanitizeBp(body.bp_systolic);
  const bp_diastolic = sanitizeBp(body.bp_diastolic);
  const symptoms = sanitizeSymptoms(body.symptoms);
  const pains = sanitizePains(body.pains);
  const notes =
    typeof body.notes === "string" && body.notes.trim()
      ? body.notes.trim().slice(0, 2000)
      : null;

  const isEmpty =
    mood == null &&
    sleep_quality == null &&
    sleep_hours == null &&
    bp_systolic == null &&
    bp_diastolic == null &&
    symptoms.length === 0 &&
    pains.length === 0 &&
    !notes;
  if (isEmpty) {
    await deleteDailyLog(patientId, params.date);
    return NextResponse.json({ ok: true, deleted: true });
  }

  const log = await upsertDailyLog({
    patient_id: patientId,
    log_date: params.date,
    mood,
    sleep_quality,
    sleep_hours,
    bp_systolic,
    bp_diastolic,
    symptoms,
    pains,
    notes,
  });

  return NextResponse.json({ ok: true, log });
}
