import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const Body = z.object({
  services: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1).max(120),
      durationMinutes: z.number().int().min(5).max(720),
      price: z.number().int().min(0).max(1000000),
      sortOrder: z.number().int(),
      isActive: z.boolean(),
    }),
  ),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const { services } = Body.parse(await req.json());

  const existing = await prisma.service.findMany({ where: { lineChannelId: id } });
  const incomingIds = new Set(services.map((s) => s.id).filter(Boolean) as string[]);
  const toDelete = existing.filter((s) => !incomingIds.has(s.id)).map((s) => s.id);

  await prisma.$transaction([
    ...(toDelete.length > 0
      ? [prisma.service.deleteMany({ where: { id: { in: toDelete } } })]
      : []),
    ...services.map((s) =>
      s.id
        ? prisma.service.update({
            where: { id: s.id },
            data: {
              name: s.name,
              durationMinutes: s.durationMinutes,
              price: s.price,
              sortOrder: s.sortOrder,
              isActive: s.isActive,
            },
          })
        : prisma.service.create({
            data: {
              lineChannelId: id,
              name: s.name,
              durationMinutes: s.durationMinutes,
              price: s.price,
              sortOrder: s.sortOrder,
              isActive: s.isActive,
            },
          }),
    ),
  ]);
  return NextResponse.json({ ok: true });
}
