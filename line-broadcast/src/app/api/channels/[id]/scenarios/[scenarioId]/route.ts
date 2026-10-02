import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import { ScenarioInput, buildStepRows } from "@/lib/scenario-input";
import { publicBaseUrl } from "@/lib/base-url";

type Ctx = { params: Promise<{ id: string; scenarioId: string }> };

async function guard(id: string, scenarioId: string) {
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const exists = await prisma.scenario.findFirst({ where: { id: scenarioId, lineChannelId: id } });
  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return null;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id, scenarioId } = await params;
  const denied = await guard(id, scenarioId);
  if (denied) return denied;

  const parsed = ScenarioInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.triggerType === "tag_added") {
    const tag = await prisma.tag.findFirst({ where: { id: body.triggerTagId!, lineChannelId: id } });
    if (!tag) return NextResponse.json({ error: "トリガーのタグがこのアカウントにありません" }, { status: 400 });
  }
  let steps;
  try {
    steps = buildStepRows(body, publicBaseUrl(req));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  // ステップは順番(order)ごとに上書きし、減った分だけ削除する。
  // 全削除→再作成にすると、進行中の友だちの「送信待ちステップ」が連動して消えてしまうため。
  // 進行中の友だちには、上書きされた内容が（未送信分に）反映される。
  await prisma.$transaction([
    ...steps.map((row) =>
      prisma.scenarioStep.upsert({
        where: { scenarioId_order: { scenarioId, order: row.order } },
        create: { scenarioId, ...row },
        update: row,
      }),
    ),
    prisma.scenarioStep.deleteMany({ where: { scenarioId, order: { gte: steps.length } } }),
    prisma.scenario.update({
      where: { id: scenarioId },
      data: {
        name: body.name,
        description: body.description ?? null,
        triggerType: body.triggerType,
        triggerTagId: body.triggerType === "tag_added" ? body.triggerTagId! : null,
        isActive: body.isActive,
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}

// 有効/無効の切り替え
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, scenarioId } = await params;
  const denied = await guard(id, scenarioId);
  if (denied) return denied;
  const parsed = z.object({ isActive: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "isActive が必要です" }, { status: 400 });
  await prisma.scenario.update({ where: { id: scenarioId }, data: { isActive: parsed.data.isActive } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, scenarioId } = await params;
  const denied = await guard(id, scenarioId);
  if (denied) return denied;
  await prisma.scenario.delete({ where: { id: scenarioId } });
  return NextResponse.json({ ok: true });
}
