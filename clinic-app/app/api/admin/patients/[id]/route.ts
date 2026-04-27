import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isValidClinicId } from "@/lib/clinics";
import { canAccessPatient, getAdminContext } from "@/lib/guards";
import { getPatientById } from "@/lib/db";

export const runtime = "nodejs";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = getAdminContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Ownership check before doing anything else.
  const target = await getPatientById(params.id);
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!canAccessPatient(target, ctx)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const updates: Record<string, string | null> = {};
  const allow: Array<
    [
      "chart_number" | "name" | "furigana" | "birth_date" | "notes" | "clinic_id",
      boolean,
    ]
  > = [
    ["chart_number", true],
    ["name", true],
    ["furigana", false],
    ["birth_date", false],
    ["notes", false],
    ["clinic_id", false],
  ];

  for (const [field, required] of allow) {
    if (!(field in body)) continue;
    // Only the master can transfer patients between clinics.
    if (field === "clinic_id" && ctx.role !== "master") {
      return NextResponse.json(
        { error: "clinic_change_master_only" },
        { status: 403 },
      );
    }
    const v = body[field];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (required && !trimmed) {
        return NextResponse.json(
          { error: "missing_fields" },
          { status: 400 },
        );
      }
      if (field === "clinic_id" && trimmed && !isValidClinicId(trimmed)) {
        return NextResponse.json(
          { error: "invalid_clinic" },
          { status: 400 },
        );
      }
      updates[field] = trimmed || null;
    } else if (v === null) {
      if (required) {
        return NextResponse.json(
          { error: "missing_fields" },
          { status: 400 },
        );
      }
      updates[field] = null;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }
  updates.updated_at = new Date().toISOString();

  // Chart number duplication check, scoped to the resulting clinic. If the
  // master is also moving the patient to another clinic, the destination
  // clinic's chart space is what matters.
  if (typeof updates.chart_number === "string") {
    const destClinic =
      "clinic_id" in updates
        ? updates.clinic_id
        : target.clinic_id;
    let q = client()
      .from("patients")
      .select("id")
      .eq("chart_number", updates.chart_number)
      .neq("id", params.id);
    if (destClinic) q = q.eq("clinic_id", destClinic);
    else q = q.is("clinic_id", null);
    const { data: existing } = await q.maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: "chart_number_taken" },
        { status: 409 },
      );
    }
  }

  const { error } = await client()
    .from("patients")
    .update(updates)
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = getAdminContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Patient deletion is master-only. Clinic admins can't accidentally wipe
  // someone else's records — or even their own — without escalation.
  if (ctx.role !== "master") {
    return NextResponse.json({ error: "delete_master_only" }, { status: 403 });
  }
  // Diagnoses + daily_logs cascade via ON DELETE CASCADE in the schema.
  const { error } = await client()
    .from("patients")
    .delete()
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
