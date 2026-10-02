import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { verifyChannelCredentials, invalidateClientCache } from "@/lib/line";

const Body = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  channelAccessToken: z.string().min(10).optional(),
  channelSecret: z.string().min(10).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = Body.parse(await req.json());

  if (body.channelAccessToken || body.channelSecret) {
    const current = await prisma.lineChannel.findUniqueOrThrow({ where: { id } });
    const token = body.channelAccessToken ?? current.channelAccessToken;
    const secret = body.channelSecret ?? current.channelSecret;
    const verify = await verifyChannelCredentials(token, secret);
    if (!verify.ok) {
      return NextResponse.json(
        { error: `LINE への接続に失敗しました: ${verify.message}` },
        { status: 400 },
      );
    }
  }

  await prisma.lineChannel.update({ where: { id }, data: body });
  invalidateClientCache(id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.lineChannel.delete({ where: { id } });
  invalidateClientCache(id);
  return NextResponse.json({ ok: true });
}
