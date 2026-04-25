import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { updateDiagnosisNote } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { staff_note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!("staff_note" in body)) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }
  const note =
    typeof body.staff_note === "string"
      ? body.staff_note.trim() || null
      : null;

  try {
    await updateDiagnosisNote(params.id, note);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
