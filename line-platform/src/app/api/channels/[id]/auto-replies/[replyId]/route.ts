import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const Patch = z.object({ isActive: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; replyId: string }> },
) {
  const { id, replyId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const body = Patch.parse(await req.json());
  await prisma.autoReply.updateMany({
    where: { id: replyId, lineChannelId: id },
    data: { isActive: body.isActive },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; replyId: string }> },
) {
  const { id, replyId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  await prisma.autoReply.deleteMany({ where: { id: replyId, lineChannelId: id } });
  return NextResponse.json({ ok: true });
}
