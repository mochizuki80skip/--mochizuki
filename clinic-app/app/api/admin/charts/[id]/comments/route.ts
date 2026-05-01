import { NextResponse } from "next/server";
import { createChartComment, listCommentsForChart } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  requireAdmin();
  const list = await listCommentsForChart(params.id);
  return NextResponse.json({ comments: list });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const ctx = requireAdmin();
  let body: { body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof body.body !== "string" || body.body.trim().length === 0) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (body.body.length > 4000) {
    return NextResponse.json({ error: "too_long" }, { status: 400 });
  }
  const c = await createChartComment({
    chart_id: params.id,
    author_role: ctx.role,
    body: body.body.trim(),
  });
  return NextResponse.json({ ok: true, comment: c });
}
