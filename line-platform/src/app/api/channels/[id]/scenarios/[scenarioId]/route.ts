import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const Body = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  triggerType: z.enum(["follow", "tag_added", "manual"]),
  triggerTagId: z.string().nullable().optional(),
  isActive: z.boolean(),
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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; scenarioId: string }> },
) {
  const { id, scenarioId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  // 境界チェック
  const exists = await prisma.scenario.findFirst({ where: { id: scenarioId, lineChannelId: id } });
  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const body = Body.parse(await req.json());

  await prisma.$transaction([
    prisma.scenarioStep.deleteMany({ where: { scenarioId } }),
    prisma.scenario.update({
      where: { id: scenarioId },
      data: {
        name: body.name,
        description: body.description ?? null,
        triggerType: body.triggerType,
        triggerTagId: body.triggerTagId ?? null,
        isActive: body.isActive,
        steps: { create: body.steps },
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; scenarioId: string }> },
) {
  const { id, scenarioId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  await prisma.scenario.deleteMany({ where: { id: scenarioId, lineChannelId: id } });
  return NextResponse.json({ ok: true });
}
