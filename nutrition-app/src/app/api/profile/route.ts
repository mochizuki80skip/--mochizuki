import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function shapeUser(u: any) {
  return {
    sex: u.sex,
    age: u.age,
    heightCm: u.heightCm,
    weightKg: u.weightKg,
    targetWeight: u.targetWeight,
    activity: u.activity,
    goal: u.goal,
    isMember: u.isMember,
    memberCode: u.memberCode,
    displayName: u.displayName,
    pictureUrl: u.pictureUrl,
    onboardedAt: u.onboardedAt,
    featExercise: u.featExercise,
    featSleep: u.featSleep,
    featWater: u.featWater,
    featSteps: u.featSteps,
    goalStartedAt: u.goalStartedAt,
    goalDeadline: u.goalDeadline,
    goalPlanSummary: u.goalPlanSummary,
    goalPlanJson: u.goalPlanJson ? JSON.parse(u.goalPlanJson) : null,
    goalApproved: u.goalApproved
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(shapeUser(user));
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
      featExercise: typeof body.featExercise === 'boolean' ? body.featExercise : undefined,
      featSleep:    typeof body.featSleep === 'boolean' ? body.featSleep : undefined,
      featWater:    typeof body.featWater === 'boolean' ? body.featWater : undefined,
      featSteps:    typeof body.featSteps === 'boolean' ? body.featSteps : undefined,
      ...memberFields
    }
  });
  return NextResponse.json(shapeUser(updated));
}
