import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel, listAccessibleChannels } from "@/lib/permissions";

// 他のアカウントへシナリオをコピーする。タグトリガーは「タグ名」で対応づけ、無ければコピー先に同名タグを作る。
// コピー先では誤配信を避けるため「無効」で作成する。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; scenarioId: string }> },
) {
  const { id, scenarioId } = await params;
  let user;
  try {
    ({ user } = await requireChannel(id));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const parsed = z
    .object({ channelIds: z.array(z.string()).min(1, "コピー先を選択してください").max(50) })
    .safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
  }
  const targets = [...new Set(parsed.data.channelIds)].filter((c) => c !== id);
  const accessible = new Set((await listAccessibleChannels(user.id, user.role)).map((c) => c.id));
  if (targets.length === 0 || targets.some((t) => !accessible.has(t))) {
    return NextResponse.json({ error: "コピー先が不正、または権限がありません" }, { status: 403 });
  }

  const src = await prisma.scenario.findFirst({
    where: { id: scenarioId, lineChannelId: id },
    include: { steps: { orderBy: { order: "asc" } }, },
  });
  if (!src) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const srcTag = src.triggerTagId ? await prisma.tag.findUnique({ where: { id: src.triggerTagId } }) : null;

  for (const target of targets) {
    let triggerTagId: string | null = null;
    if (src.triggerType === "tag_added" && srcTag) {
      const tag = await prisma.tag.upsert({
        where: { lineChannelId_name: { lineChannelId: target, name: srcTag.name } },
        create: { lineChannelId: target, name: srcTag.name, color: srcTag.color },
        update: {},
      });
      triggerTagId = tag.id;
    }
    await prisma.scenario.create({
      data: {
        lineChannelId: target,
        name: src.name,
        description: src.description,
        triggerType: src.triggerType,
        triggerTagId,
        isActive: false,
        steps: {
          create: src.steps.map((s) => ({
            order: s.order,
            delayMinutes: s.delayMinutes,
            sendTime: s.sendTime,
            messages: s.messages as object[],
            blocks: (s.blocks ?? undefined) as object[] | undefined,
          })),
        },
      },
    });
  }
  return NextResponse.json({ ok: true, copied: targets.length });
}
