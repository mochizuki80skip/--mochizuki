import { NextRequest, NextResponse } from "next/server";
import { runReport, startReport } from "@/lib/analysis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 週 1 回（例：月曜 8:00）叩くと分析レポートを作成
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { report, created } = await startReport("自動（週次）");
  if (created) await runReport(report.id);
  return NextResponse.json({ ok: true, reportId: report.id, created });
}
