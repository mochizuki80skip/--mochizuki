import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({
    sex: user.sex,
    age: user.age,
    heightCm: user.heightCm,
    weightKg: user.weightKg,
    targetWeight: user.targetWeight,
    activity: user.activity,
    goal: user.goal,
    isMember: user.isMember,
    memberCode: user.memberCode,
    displayName: user.displayName,
    pictureUrl: user.pictureUrl,
    onboardedAt: user.onboardedAt
  });
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  // 会員コード適用ロジック
  let memberFields: any = {};
  if (body.memberCode && !user.isMember) {
    const code = await prisma.memberCode.findUnique({ where: { code: String(body.memberCode).toUpperCase().trim() } });
    if (code && !code.used) {
      memberFields = {
        isMember: true,
        memberCode: code.code,
        memberSince: new Date()
      };
      await prisma.memberCode.update({
        where: { code: code.code },
        data: { used: true, usedByUser: user.id, usedAt: new Date() }
      });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      sex: body.sex ?? undefined,
      age: body.age != null ? Number(body.age) : undefined,
      heightCm: body.heightCm != null ? Number(body.heightCm) : undefined,
      weightKg: body.weightKg != null ? Number(body.weightKg) : undefined,
      targetWeight: body.targetWeight != null ? Number(body.targetWeight) : undefined,
      activity: body.activity ?? undefined,
      goal: body.goal ?? undefined,
      onboardedAt: body.onboardedAt ? new Date(body.onboardedAt) : (user.onboardedAt ?? new Date()),
      ...memberFields
    }
  });
  return NextResponse.json({
    sex: updated.sex,
    age: updated.age,
    heightCm: updated.heightCm,
    weightKg: updated.weightKg,
    targetWeight: updated.targetWeight,
    activity: updated.activity,
    goal: updated.goal,
    isMember: updated.isMember,
    memberCode: updated.memberCode,
    displayName: updated.displayName,
    pictureUrl: updated.pictureUrl,
    onboardedAt: updated.onboardedAt
  });
}
