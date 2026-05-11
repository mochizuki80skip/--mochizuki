import type { Message } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { pushTo } from "@/lib/line";

// 友だち追加トリガーのシナリオを起動する
export async function startScenariosForFollow(friendId: string) {
  const scenarios = await prisma.scenario.findMany({
    where: { triggerType: "follow", isActive: true },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  for (const sc of scenarios) {
    await startScenarioForFriend(sc.id, friendId);
  }
}

// タグ付与トリガーのシナリオを起動する
export async function startScenariosForTag(friendId: string, tagId: string) {
  const scenarios = await prisma.scenario.findMany({
    where: { triggerType: "tag_added", triggerTagId: tagId, isActive: true },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  for (const sc of scenarios) {
    await startScenarioForFriend(sc.id, friendId);
  }
}

export async function startScenarioForFriend(scenarioId: string, friendId: string) {
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!scenario || !scenario.isActive || scenario.steps.length === 0) return;

  // 既存の run があれば二重起動しない
  const existing = await prisma.scenarioRun.findUnique({
    where: { scenarioId_friendId: { scenarioId, friendId } },
  });
  if (existing) return;

  const run = await prisma.scenarioRun.create({
    data: { scenarioId, friendId, status: "running" },
  });

  // 各ステップを delayMinutes の累積で予約
  let cursor = new Date();
  const runSteps = scenario.steps.map((step) => {
    cursor = new Date(cursor.getTime() + step.delayMinutes * 60_000);
    return {
      runId: run.id,
      stepId: step.id,
      scheduledAt: new Date(cursor),
      status: "pending" as const,
    };
  });
  await prisma.scenarioRunStep.createMany({ data: runSteps });
}

// ワーカーが呼ぶ：到来した予約ステップを送信する
export async function dispatchDueScenarioSteps(now: Date = new Date()) {
  const due = await prisma.scenarioRunStep.findMany({
    where: { status: "pending", scheduledAt: { lte: now } },
    include: {
      step: true,
      run: { include: { friend: true } },
    },
    take: 100,
    orderBy: { scheduledAt: "asc" },
  });

  for (const rs of due) {
    if (!rs.run.friend.isFollowing) {
      await prisma.scenarioRunStep.update({
        where: { id: rs.id },
        data: { status: "skipped", errorMessage: "friend not following" },
      });
      continue;
    }
    try {
      const messages = rs.step.messages as unknown as Message[];
      await pushTo(rs.run.friend.lineUserId, messages);
      await prisma.scenarioRunStep.update({
        where: { id: rs.id },
        data: { status: "sent", sentAt: new Date() },
      });
      await prisma.deliveryLog.create({
        data: {
          friendId: rs.run.friend.id,
          channel: "scenario",
          status: "success",
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      await prisma.scenarioRunStep.update({
        where: { id: rs.id },
        data: { status: "failed", errorMessage: msg },
      });
      await prisma.deliveryLog.create({
        data: {
          friendId: rs.run.friend.id,
          channel: "scenario",
          status: "failed",
          errorMessage: msg,
        },
      });
    }
  }

  // 全ステップが終端状態になった run を完了に
  await prisma.$executeRaw`
    UPDATE "ScenarioRun" r
    SET "status" = 'completed', "finishedAt" = NOW()
    WHERE r.status = 'running'
      AND NOT EXISTS (
        SELECT 1 FROM "ScenarioRunStep" s
        WHERE s."runId" = r.id AND s.status = 'pending'
      )
  `;

  return due.length;
}
