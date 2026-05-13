import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const PatchSchema = z.object({ notes: z.string().max(5000).optional() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; friendId: string }> },
) {
  const { id, friendId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const body = PatchSchema.parse(await req.json());
  const updated = await prisma.friend.updateMany({
    where: { id: friendId, lineChannelId: id },
    data: body,
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
