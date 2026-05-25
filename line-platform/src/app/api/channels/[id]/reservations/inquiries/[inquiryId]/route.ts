import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const Body = z.object({ status: z.enum(["pending", "handled", "cancelled"]) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; inquiryId: string }> },
) {
  const { id, inquiryId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const { status } = Body.parse(await req.json());
  const updated = await prisma.inquiry.updateMany({
    where: { id: inquiryId, lineChannelId: id },
    data: { status },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
