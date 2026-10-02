import { NextRequest, NextResponse } from "next/server";
import { dispatchDueScenarioSteps } from "@/lib/scenario";
import { dispatchScheduledBroadcasts } from "@/lib/broadcast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel の最大実行時間を伸ばす
export const maxDuration = 60;

// Vercel Cron からのみ叩かれる想定。CRON_SECRET でガード。
async function authorized(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // 未設定なら誰でも可（ローカル用）
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${expected}`;
}

async function handle(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [scenarios, broadcasts] = await Promise.all([
    dispatchDueScenarioSteps(),
    dispatchScheduledBroadcasts(),
  ]);
  return NextResponse.json({ ok: true, scenarios, broadcasts });
}

export const GET = handle;
export const POST = handle;
