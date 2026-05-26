import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createReservation } from "@/lib/reservation";
import { submitInquiry } from "@/lib/inquiry";

export const dynamic = "force-dynamic";

const DbBody = z.object({
  serviceId: z.string(),
  startAt: z.string(),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(1).max(50),
  referralSource: z.string().max(120).nullable().optional(),
  lineUserId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const SheetBody = z.object({
  visitType: z.enum(["new", "returning"]),
  preferences: z
    .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d{1,2}:\d{2}$/) }))
    .min(1)
    .max(3),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().max(50).optional().default(""),
  referralSource: z.string().max(120).nullable().optional(),
  lineUserId: z.string().nullable().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;
  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
  });
  if (!settings?.isEnabled) {
    return NextResponse.json({ error: "reservations not enabled" }, { status: 404 });
  }

  const raw = await req.json().catch(() => null);
  if (!raw) return NextResponse.json({ error: "invalid input" }, { status: 400 });

  // === シート連動モード：問い合わせ一覧へリクエスト ===
  if (settings.sheetLinkedMode) {
    const parsed = SheetBody.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid input" }, { status: 400 });
    }
    const b = parsed.data;
    // 2回目以降は電話任意・きっかけ不要
    if (b.visitType === "new" && !b.customerPhone) {
      return NextResponse.json({ error: "電話番号は必須です" }, { status: 400 });
    }
    const result = await submitInquiry({
      channelId,
      preferences: b.preferences,
      visitType: b.visitType,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      referralSource: b.referralSource ?? null,
      lineUserId: b.lineUserId ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mode: "inquiry" });
  }

  // === 従来 DB モード ===
  const parsed = DbBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const body = parsed.data;
  const startAt = new Date(body.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "invalid startAt" }, { status: 400 });
  }

  const result = await createReservation({
    channelId,
    serviceId: body.serviceId,
    startAt,
    customerName: body.customerName,
    customerPhone: body.customerPhone,
    referralSource: body.referralSource ?? null,
    lineUserId: body.lineUserId ?? null,
    notes: body.notes ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true, mode: "db", reservationId: result.reservationId });
}
