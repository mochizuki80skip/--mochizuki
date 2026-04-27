import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";
import { isValidClinicId } from "@/lib/clinics";

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
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
    const v = body[field];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (required && !trimmed) {
        return NextResponse.json(
          { error: "missing_fields" },
          { status: 400 },
        );
      }
      // Reject unknown clinic ids so we never write garbage to the column.
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

  // If chart_number is being changed, ensure it doesn't conflict.
  if (typeof updates.chart_number === "string") {
    const { data: existing } = await client()
      .from("patients")
      .select("id")
      .eq("chart_number", updates.chart_number)
      .neq("id", params.id)
      .maybeSingle();
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
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Diagnoses are removed via ON DELETE CASCADE in the schema.
  const { error } = await client()
    .from("patients")
    .delete()
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
