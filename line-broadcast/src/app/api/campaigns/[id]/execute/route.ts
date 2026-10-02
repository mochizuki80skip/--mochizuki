import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, listAccessibleChannels } from "@/lib/permissions";
import { executeCampaignBroadcasts } from "@/lib/campaign";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const accessible = (await listAccessibleChannels(user.id, user.role)).map((c) => c.id);
  const results = await executeCampaignBroadcasts(id, accessible);
  return NextResponse.json({ ok: true, results });
}
