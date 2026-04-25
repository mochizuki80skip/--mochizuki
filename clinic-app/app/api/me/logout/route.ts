import { NextResponse } from "next/server";
import { clearPatientCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  clearPatientCookie();
  return NextResponse.json({ ok: true });
}
