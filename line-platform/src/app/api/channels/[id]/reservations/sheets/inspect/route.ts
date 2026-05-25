import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import { isSheetsConfigured, listTabs, readRange } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// シート構造を確認するためのインスペクター（開発用）
// GET ?tab=タブ名  指定タブの A1:Z50 を返す
// tab 未指定なら全タブ名のみ返す
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  if (!isSheetsConfigured()) {
    return NextResponse.json({ error: "GOOGLE_SERVICE_ACCOUNT_JSON 未設定" }, { status: 400 });
  }

  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: id },
  });
  if (!settings?.spreadsheetId) {
    return NextResponse.json({ error: "スプレッドシートID未設定" }, { status: 400 });
  }

  const sheetId = settings.spreadsheetId;
  const tab = req.nextUrl.searchParams.get("tab");

  try {
    const tabs = await listTabs(sheetId);
    if (!tab) {
      return NextResponse.json({ spreadsheetId: sheetId, tabs });
    }
    const range = req.nextUrl.searchParams.get("range") ?? `${tab}!A1:Z50`;
    const values = await readRange(sheetId, range);
    // 行番号付きで返す（読みやすさのため）
    const numbered = values.map((row, i) => ({ row: i + 1, cells: row }));
    return NextResponse.json({ spreadsheetId: sheetId, tab, range, rowCount: values.length, values: numbered });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "読み取り失敗" },
      { status: 500 },
    );
  }
}
