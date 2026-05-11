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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = Body.parse(await req.json());
  const created = await prisma.scenario.create({
    data: {
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
