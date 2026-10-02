import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import { ScenarioInput, buildStepRows } from "@/lib/scenario-input";
import { publicBaseUrl } from "@/lib/base-url";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
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
  const created = await prisma.scenario.create({
    data: {
      lineChannelId: id,
      name: body.name,
      description: body.description ?? null,
      triggerType: body.triggerType,
      triggerTagId: body.triggerType === "tag_added" ? body.triggerTagId! : null,
      isActive: body.isActive,
      steps: { create: steps },
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
