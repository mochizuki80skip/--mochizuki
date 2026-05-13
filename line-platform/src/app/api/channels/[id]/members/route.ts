import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";

const Body = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  password: z.string().min(8).optional(), // 新規ユーザー作成時に必須
  role: z.enum(["owner", "operator"]).default("operator"),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const body = Body.parse(await req.json());

  let user = await prisma.adminUser.findUnique({ where: { email: body.email } });
  if (!user) {
    if (!body.password) {
      return NextResponse.json(
        { error: "新規ユーザーには password が必要です" },
        { status: 400 },
      );
    }
    user = await prisma.adminUser.create({
      data: {
        email: body.email,
        name: body.name ?? null,
        passwordHash: await bcrypt.hash(body.password, 10),
        role: "operator", // チャネルメンバーは operator として作成
      },
    });
  }

  await prisma.channelMembership.upsert({
    where: { adminUserId_lineChannelId: { adminUserId: user.id, lineChannelId: id } },
    create: { adminUserId: user.id, lineChannelId: id, role: body.role },
    update: { role: body.role },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}

const DeleteBody = z.object({ adminUserId: z.string() });

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const { adminUserId } = DeleteBody.parse(await req.json());
  await prisma.channelMembership
    .delete({ where: { adminUserId_lineChannelId: { adminUserId, lineChannelId: id } } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
