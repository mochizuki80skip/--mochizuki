import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({
    goalType: user.goal,
    targetWeight: user.targetWeight,
    goalStartedAt: user.goalStartedAt,
    goalDeadline: user.goalDeadline,
    goalPlanSummary: user.goalPlanSummary,
    goalPlanJson: user.goalPlanJson ? JSON.parse(user.goalPlanJson) : null,
    goalApproved: user.goalApproved
  });
}

/**
 * 目標を保存（承認）
 * body: { goalType, targetWeight, goalStartedAt, goalDeadline, goalPlanSummary, goalPlanJson }
 */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      goal: body.goalType ?? user.goal,
      targetWeight: body.targetWeight != null ? Number(body.targetWeight) : user.targetWeight,
      goalStartedAt: body.goalStartedAt ? new Date(body.goalStartedAt) : user.goalStartedAt,
      goalDeadline: body.goalDeadline ? new Date(body.goalDeadline) : user.goalDeadline,
      goalPlanSummary: typeof body.goalPlanSummary === 'string' ? body.goalPlanSummary : undefined,
      goalPlanJson: body.goalPlanJson ? JSON.stringify(body.goalPlanJson) : undefined,
      goalApproved: typeof body.goalApproved === 'boolean' ? body.goalApproved : true
    }
  });

  return NextResponse.json({
    goalType: updated.goal,
    targetWeight: updated.targetWeight,
    goalStartedAt: updated.goalStartedAt,
    goalDeadline: updated.goalDeadline,
    goalPlanSummary: updated.goalPlanSummary,
    goalPlanJson: updated.goalPlanJson ? JSON.parse(updated.goalPlanJson) : null,
    goalApproved: updated.goalApproved
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await prisma.user.update({
    where: { id: user.id },
    data: {
      goalStartedAt: null,
      goalDeadline: null,
      goalPlanSummary: null,
      goalPlanJson: null,
      goalApproved: false
    }
  });
  return NextResponse.json({ ok: true });
}
