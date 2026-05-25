import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import { isSheetsConfigured, verifySpreadsheetAccess, ensureSheetTabs } from "@/lib/sheets";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  if (!isSheetsConfigured()) {
    return NextResponse.json(
      { ok: false, error: "サーバー側で GOOGLE_SERVICE_ACCOUNT_JSON が未設定です。Vercel の環境変数を確認してください。" },
      { status: 400 },
    );
  }

  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: id },
  });
  if (!settings?.spreadsheetId) {
    return NextResponse.json({ ok: false, error: "スプレッドシート ID が未設定です。" }, { status: 400 });
  }

  const result = await verifySpreadsheetAccess(settings.spreadsheetId);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error + "（サービスアカウントへの共有を確認）" },
      { status: 400 },
    );
  }

  // タブが揃ってなければ自動作成
  // シート連動モードでは「問い合わせ一覧」だけ。DB モードでは従来の各タブ。
  if (settings.sheetLinkedMode) {
    await ensureSheetTabs(settings.spreadsheetId, [settings.sheetTabInquiry]);
  } else {
    await ensureSheetTabs(settings.spreadsheetId, [
      settings.sheetTabReservations,
      settings.sheetTabSettings,
      settings.sheetTabMenu,
      settings.sheetTabHours,
      settings.sheetTabReferral,
    ]);
  }

  return NextResponse.json({ ok: true, title: result.title });
}
