import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = Body.parse(await req.json());

  // ステップは全消し→作り直し（関連の ScenarioRunStep は残るが、未送信のものは
  // step が消えると onDelete: Cascade で消える。これは想定挙動）
  await prisma.$transaction([
    prisma.scenarioStep.deleteMany({ where: { scenarioId: id } }),
    prisma.scenario.update({
      where: { id },
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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.scenario.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
