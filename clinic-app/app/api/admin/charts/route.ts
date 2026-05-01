import { NextResponse } from "next/server";
import { upsertChart } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";
import type { ChartMarker } from "@/lib/types";

export const runtime = "nodejs";

const VALID_TYPES = new Set([
  "needle",
  "intra",
  "moxa",
  "manual",
  "muscle",
  "skeletal",
]);
const VALID_VIEWS = new Set(["front", "back"]);

function isValidMarker(m: unknown): m is ChartMarker {
  if (!m || typeof m !== "object") return false;
  const o = m as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.view === "string" &&
    VALID_VIEWS.has(o.view as string) &&
    typeof o.type === "string" &&
    VALID_TYPES.has(o.type as string)
  );
}

export async function POST(req: Request) {
  const ctx = requireAdmin();
  let body: {
    visit_id?: unknown;
    patient_id?: unknown;
    markers?: unknown;
    free_note?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof body.visit_id !== "string" || typeof body.patient_id !== "string") {
    return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
  }
  if (!Array.isArray(body.markers) || !body.markers.every(isValidMarker)) {
    return NextResponse.json({ error: "invalid_markers" }, { status: 400 });
  }

  const row = await upsertChart({
    visit_id: body.visit_id,
    patient_id: body.patient_id,
    recorded_by: ctx.role,
    markers: body.markers as ChartMarker[],
    free_note:
      typeof body.free_note === "string" && body.free_note.trim().length > 0
        ? body.free_note
        : null,
  });

  return NextResponse.json({ ok: true, id: row.id });
}
