import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import { startScenariosForTag } from "@/lib/scenario";

const Body = z.object({ tagId: z.string() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; friendId: string }> },
) {
  const { id, friendId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const { tagId } = Body.parse(await req.json());

  // タグも同チャネルかチェック
  const tag = await prisma.tag.findFirst({ where: { id: tagId, lineChannelId: id } });
  const friend = await prisma.friend.findFirst({ where: { id: friendId, lineChannelId: id } });
  if (!tag || !friend) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.friendTag.upsert({
    where: { friendId_tagId: { friendId, tagId } },
    create: { friendId, tagId },
    update: {},
  });

  await startScenariosForTag(id, friendId, tagId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; friendId: string }> },
) {
  const { id, friendId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const { tagId } = Body.parse(await req.json());
  await prisma.friendTag.delete({ where: { friendId_tagId: { friendId, tagId } } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
