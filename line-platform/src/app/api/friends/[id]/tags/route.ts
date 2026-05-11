import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { startScenariosForTag } from "@/lib/scenario";

const Body = z.object({ tagId: z.string() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { tagId } = Body.parse(await req.json());

  await prisma.friendTag.upsert({
    where: { friendId_tagId: { friendId: id, tagId } },
    create: { friendId: id, tagId },
    update: {},
  });

  // tag_added トリガーのシナリオを起動
  await startScenariosForTag(id, tagId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const { tagId } = Body.parse(await req.json());
  await prisma.friendTag
    .delete({ where: { friendId_tagId: { friendId: id, tagId } } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
