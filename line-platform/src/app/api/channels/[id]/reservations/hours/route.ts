import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const TIME = /^\d{2}:\d{2}$/;
const Body = z.object({
  hours: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      isClosed: z.boolean(),
      openTime: z.string().regex(TIME).or(z.literal("")),
      closeTime: z.string().regex(TIME).or(z.literal("")),
    }),
  ).length(7),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const { hours } = Body.parse(await req.json());

  await prisma.$transaction(
    hours.map((h) =>
      prisma.businessHours.upsert({
        where: { lineChannelId_dayOfWeek: { lineChannelId: id, dayOfWeek: h.dayOfWeek } },
        create: {
          lineChannelId: id,
          dayOfWeek: h.dayOfWeek,
          isClosed: h.isClosed,
          openTime: h.isClosed ? null : (h.openTime || null),
          closeTime: h.isClosed ? null : (h.closeTime || null),
        },
        update: {
          isClosed: h.isClosed,
          openTime: h.isClosed ? null : (h.openTime || null),
          closeTime: h.isClosed ? null : (h.closeTime || null),
        },
      }),
    ),
  );
  return NextResponse.json({ ok: true });
}
