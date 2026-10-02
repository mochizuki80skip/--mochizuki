import type { Message } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { pushTo } from "@/lib/line";

// 友だち追加トリガーのシナリオを起動する（チャネル単位）
export async function startScenariosForFollow(channelId: string, friendId: string) {
  const scenarios = await prisma.scenario.findMany({
    where: { lineChannelId: channelId, triggerType: "follow", isActive: true },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  for (const sc of scenarios) {
    await startScenarioForFriend(sc.id, friendId);
  }
}

// タグ付与トリガー
export async function startScenariosForTag(channelId: string, friendId: string, tagId: string) {
  const scenarios = await prisma.scenario.findMany({
    where: {
      lineChannelId: channelId,
      triggerType: "tag_added",
      triggerTagId: tagId,
      isActive: true,
    },
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

  const existing = await prisma.scenarioRun.findUnique({
    where: { scenarioId_friendId: { scenarioId, friendId } },
  });
  if (existing) return;

  const run = await prisma.scenarioRun.create({
    data: { scenarioId, friendId, status: "running" },
  });

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
// 全チャネル横断で動く（各 step → friend → channel を辿ってチャネル特定）
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
    const friend = rs.run.friend;
    if (!friend.isFollowing) {
      await prisma.scenarioRunStep.update({
        where: { id: rs.id },
        data: { status: "skipped", errorMessage: "friend not following" },
      });
      continue;
    }
    try {
      const messages = rs.step.messages as unknown as Message[];
      await pushTo(friend.lineChannelId, friend.lineUserId, messages);
      await prisma.scenarioRunStep.update({
        where: { id: rs.id },
        data: { status: "sent", sentAt: new Date() },
      });
      await prisma.deliveryLog.create({
        data: {
          lineChannelId: friend.lineChannelId,
          friendId: friend.id,
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
          lineChannelId: friend.lineChannelId,
          friendId: friend.id,
          channel: "scenario",
          status: "failed",
          errorMessage: msg,
        },
      });
    }
  }

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
