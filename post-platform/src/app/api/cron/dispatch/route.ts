import { NextRequest, NextResponse } from "next/server";
import { dispatchDue, refreshInstagramTokens } from "@/lib/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 外部 Cron（cron-job.org など）から 5〜10 分おきに叩く。CRON_SECRET でガード
async function handle(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sent = await dispatchDue();
  const refreshed = await refreshInstagramTokens();
  return NextResponse.json({ ok: true, sent, refreshed });
}

export const GET = handle;
export const POST = handle;
