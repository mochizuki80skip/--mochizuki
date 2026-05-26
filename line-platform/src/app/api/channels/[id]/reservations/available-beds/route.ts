// 指定日時・来院区分で空いているベッド一覧（確定UI用）
import { NextRequest, NextResponse } from "next/server";
import { requireChannel } from "@/lib/permissions";
import { availableBedsAt } from "@/lib/availabilityDb";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{1,2}:\d{2}$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const time = url.searchParams.get("time");
  const visitType = url.searchParams.get("visitType") === "new" ? "new" : "returning";

  if (!date || !DATE.test(date) || !time || !TIME.test(time)) {
    return NextResponse.json({ error: "missing date/time" }, { status: 400 });
  }

  const beds = await availableBedsAt({ channelId: id, date, time, visitType });
  return NextResponse.json({ beds });
}
