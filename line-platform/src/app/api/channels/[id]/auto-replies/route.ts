import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";

const Body = z.object({
  keyword: z.string().min(1).max(300),
  matchType: z.enum(["exact", "contains"]).default("exact"),
  messages: z.array(z.record(z.any())).min(1).max(5),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const body = Body.parse(await req.json());
  const rule = await prisma.autoReply.create({
    data: {
      lineChannelId: id,
      keyword: body.keyword.trim(),
      matchType: body.matchType,
      messages: body.messages,
    },
  });
  return NextResponse.json(rule);
}
