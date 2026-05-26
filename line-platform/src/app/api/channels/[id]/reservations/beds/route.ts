// 日次ベッド担当（DailyBed）の取得・一括更新
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import { regenerateDailyTab } from "@/lib/dailyTab";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{1,2}:\d{2}$/;

const Body = z.object({
  date: z.string().regex(DATE),
  beds: z.array(
    z.object({
      bedNumber: z.number().int().min(1).max(50),
      therapistName: z.string().trim().max(50),
      acceptsNew: z.boolean(),
    }),
  ),
  breaks: z
    .array(
      z.object({
        startTime: z.string().regex(TIME),
        endTime: z.string().regex(TIME),
      }),
    )
    .optional(),
});

// GET ?date=YYYY-MM-DD … その日のベッド一覧
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const date = new URL(req.url).searchParams.get("date");
  if (!date || !DATE.test(date)) {
    return NextResponse.json({ error: "missing date" }, { status: 400 });
  }
  const [beds, breaks] = await Promise.all([
    prisma.dailyBed.findMany({
      where: { lineChannelId: id, date },
      orderBy: { bedNumber: "asc" },
    }),
    prisma.dailyBreak.findMany({
      where: { lineChannelId: id, date },
      orderBy: { startTime: "asc" },
    }),
  ]);
  return NextResponse.json({ date, beds, breaks });
}

// PUT … その日のベッド一覧を置き換え（空名は削除扱い）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const { date, beds, breaks } = Body.parse(await req.json());

  // 名前のあるベッドのみ残す
  const keep = beds.filter((b) => b.therapistName.length > 0);
  const keepNumbers = keep.map((b) => b.bedNumber);
  // 開始 < 終了 の休憩のみ残す
  const keepBreaks = (breaks ?? []).filter((b) => b.startTime < b.endTime);

  await prisma.$transaction([
    // この日の、今回残さないベッドを削除
    prisma.dailyBed.deleteMany({
      where: {
        lineChannelId: id,
        date,
        ...(keepNumbers.length > 0 ? { bedNumber: { notIn: keepNumbers } } : {}),
      },
    }),
    ...keep.map((b) =>
      prisma.dailyBed.upsert({
        where: { lineChannelId_date_bedNumber: { lineChannelId: id, date, bedNumber: b.bedNumber } },
        create: {
          lineChannelId: id,
          date,
          bedNumber: b.bedNumber,
          therapistName: b.therapistName,
          acceptsNew: b.acceptsNew,
        },
        update: { therapistName: b.therapistName, acceptsNew: b.acceptsNew },
      }),
    ),
    // 休憩は全削除 → 再作成（置き換え）
    prisma.dailyBreak.deleteMany({ where: { lineChannelId: id, date } }),
    ...(keepBreaks.length > 0
      ? [
          prisma.dailyBreak.createMany({
            data: keepBreaks.map((b) => ({
              lineChannelId: id,
              date,
              startTime: b.startTime,
              endTime: b.endTime,
            })),
          }),
        ]
      : []),
  ]);

  // スプレッドシート当日タブを再生成（best effort）
  try {
    await regenerateDailyTab(id, date);
  } catch (e) {
    console.error("[beds] sheet regen failed:", e);
  }

  return NextResponse.json({ ok: true, count: keep.length });
}
