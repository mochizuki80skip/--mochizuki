import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import { isSheetsConfigured } from "@/lib/sheets";
import { syncAllTabs } from "@/lib/sheetSync";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  if (!isSheetsConfigured()) {
    return NextResponse.json(
      { error: "Google Sheets が未設定です（GOOGLE_SERVICE_ACCOUNT_JSON）" },
      { status: 400 },
    );
  }

  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: id },
  });
  if (!settings?.spreadsheetId) {
    return NextResponse.json({ error: "スプレッドシートIDが未設定です" }, { status: 400 });
  }

  try {
    await syncAllTabs(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "同期に失敗しました" },
      { status: 500 },
    );
  }
}
