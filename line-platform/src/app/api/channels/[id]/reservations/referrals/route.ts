import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const Body = z.object({
  referrals: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1).max(120),
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
  const { referrals } = Body.parse(await req.json());

  const existing = await prisma.referralSource.findMany({ where: { lineChannelId: id } });
  const incomingIds = new Set(referrals.map((r) => r.id).filter(Boolean) as string[]);
  const toDelete = existing.filter((s) => !incomingIds.has(s.id)).map((s) => s.id);

  await prisma.$transaction([
    ...(toDelete.length > 0
      ? [prisma.referralSource.deleteMany({ where: { id: { in: toDelete } } })]
      : []),
    ...referrals.map((r) =>
      r.id
        ? prisma.referralSource.update({
            where: { id: r.id },
            data: { name: r.name, sortOrder: r.sortOrder, isActive: r.isActive },
          })
        : prisma.referralSource.create({
            data: {
              lineChannelId: id,
              name: r.name,
              sortOrder: r.sortOrder,
              isActive: r.isActive,
            },
          }),
    ),
  ]);
  return NextResponse.json({ ok: true });
}
