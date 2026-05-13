import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const Body = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  triggerType: z.enum(["follow", "tag_added", "manual"]),
  triggerTagId: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  steps: z
    .array(
      z.object({
        order: z.number().int().min(0),
        delayMinutes: z.number().int().min(0).max(60 * 24 * 365),
        messages: z.array(z.record(z.any())).min(1),
      }),
    )
    .min(1),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const body = Body.parse(await req.json());
  const created = await prisma.scenario.create({
    data: {
      lineChannelId: id,
      name: body.name,
      description: body.description ?? null,
      triggerType: body.triggerType,
      triggerTagId: body.triggerTagId ?? null,
      isActive: body.isActive,
      steps: { create: body.steps },
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
