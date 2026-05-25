import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const Body = z.object({
  isEnabled: z.boolean().optional(),
  slotMinutes: z.number().int().min(5).max(120).optional(),
  defaultBedCount: z.number().int().min(1).max(50).optional(),
  bookingHorizonDays: z.number().int().min(1).max(365).optional(),
  bookingLeadHours: z.number().int().min(0).max(720).optional(),
  clinicName: z.string().max(120).nullable().optional(),
  clinicAddress: z.string().max(255).nullable().optional(),
  clinicPhone: z.string().max(50).nullable().optional(),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  liffId: z.string().max(120).nullable().optional(),
  sendConfirmMessage: z.boolean().optional(),
  confirmMessageTemplate: z.string().max(1000).nullable().optional(),
  spreadsheetId: z.string().max(120).nullable().optional(),
  sheetTabReservations: z.string().max(120).optional(),
  // シート連動モード
  sheetLinkedMode: z.boolean().optional(),
  sheetTabInquiry: z.string().max(120).optional(),
  newPatientDurationMinutes: z.number().int().min(5).max(240).optional(),
  returningDurationMinutes: z.number().int().min(5).max(240).optional(),
  inquiryReplyMessage: z.string().max(1000).nullable().optional(),
});

function emptyToNull<T extends Record<string, unknown>>(obj: T): T {
  const cleaned: Record<string, unknown> = { ...obj };
  for (const k of ["clinicName", "clinicAddress", "clinicPhone", "liffId", "spreadsheetId", "confirmMessageTemplate", "inquiryReplyMessage"]) {
    if (cleaned[k] === "") cleaned[k] = null;
  }
  return cleaned as T;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const body = emptyToNull(Body.parse(await req.json()));
  await prisma.reservationSettings.upsert({
    where: { lineChannelId: id },
    create: { lineChannelId: id, ...body },
    update: body,
  });
  return NextResponse.json({ ok: true });
}
