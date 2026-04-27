import { NextResponse } from "next/server";
import { checkAdminPassword, setAdminCookie } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let password = "";
  try {
    const body = await req.json();
    password = typeof body?.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!password) {
    return NextResponse.json({ error: "password_required" }, { status: 400 });
  }
  const role = checkAdminPassword(password);
  if (!role) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  setAdminCookie(role);
  return NextResponse.json({ ok: true, role });
}
