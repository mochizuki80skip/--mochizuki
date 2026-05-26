// 日次ベッド担当（DailyBed）の取得・一括更新
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const Body = z.object({
  date: z.string().regex(DATE),
  beds: z.array(
    z.object({
      bedNumber: z.number().int().min(1).max(50),
      therapistName: z.string().trim().max(50),
      acceptsNew: z.boolean(),
    }),
  ),
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
  const beds = await prisma.dailyBed.findMany({
    where: { lineChannelId: id, date },
    orderBy: { bedNumber: "asc" },
  });
  return NextResponse.json({ date, beds });
}

// PUT … その日のベッド一覧を置き換え（空名は削除扱い）
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const { date, beds } = Body.parse(await req.json());

  // 名前のあるベッドのみ残す
  const keep = beds.filter((b) => b.therapistName.length > 0);
  const keepNumbers = keep.map((b) => b.bedNumber);

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
  ]);

  return NextResponse.json({ ok: true, count: keep.length });
}
