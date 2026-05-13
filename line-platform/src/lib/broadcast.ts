import type { Message } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { broadcastAll, multicastTo } from "@/lib/line";

async function resolveTargets(broadcastId: string): Promise<{
  channelId: string;
  targetAll: boolean;
  userIds: string[];
  totalIfAll: number;
}> {
  const b = await prisma.broadcast.findUniqueOrThrow({
    where: { id: broadcastId },
    include: { tags: true },
  });

  const channelId = b.lineChannelId;

  if (b.targetAllFollowers && b.tags.length === 0) {
    const total = await prisma.friend.count({
      where: { lineChannelId: channelId, isFollowing: true },
    });
    return { channelId, targetAll: true, userIds: [], totalIfAll: total };
  }

  const friends = await prisma.friend.findMany({
    where: {
      lineChannelId: channelId,
      isFollowing: true,
      tags: { some: { tagId: { in: b.tags.map((t) => t.tagId) } } },
    },
    select: { lineUserId: true },
  });
  return {
    channelId,
    targetAll: false,
    userIds: friends.map((f) => f.lineUserId),
    totalIfAll: 0,
  };
}

export async function executeBroadcast(broadcastId: string) {
  const b = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcastId } });
  if (b.status !== "draft" && b.status !== "scheduled") {
    throw new Error(`broadcast already ${b.status}`);
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: "sending" },
  });

  try {
    const { channelId, targetAll, userIds, totalIfAll } = await resolveTargets(broadcastId);
    const messages = b.messages as unknown as Message[];

    if (targetAll) {
      await broadcastAll(channelId, messages);
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: {
          status: "sent",
          sentAt: new Date(),
          totalTargets: totalIfAll,
          successCount: totalIfAll,
        },
      });
      await prisma.deliveryLog.create({
        data: {
          lineChannelId: channelId,
          broadcastId,
          channel: "broadcast",
          status: "success",
        },
      });
      return;
    }

    const result = await multicastTo(channelId, userIds, messages);
    const failed = result.failedChunks > 0;
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: failed ? "failed" : "sent",
        sentAt: new Date(),
        totalTargets: userIds.length,
        successCount: result.successChunks * 500,
        failureCount: result.failedChunks * 500,
        errorMessage: result.errors.join("\n") || null,
      },
    });
    await prisma.deliveryLog.create({
      data: {
        lineChannelId: channelId,
        broadcastId,
        channel: "multicast",
        status: failed ? "failed" : "success",
        errorMessage: result.errors.join("\n") || null,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "failed", errorMessage: msg },
    });
    throw err;
  }
}

export async function dispatchScheduledBroadcasts(now: Date = new Date()) {
  const due = await prisma.broadcast.findMany({
    where: { status: "scheduled", scheduledAt: { lte: now } },
    take: 10,
  });
  for (const b of due) {
    try {
      await executeBroadcast(b.id);
    } catch (e) {
      console.error("[broadcast] failed", b.id, e);
    }
  }
  return due.length;
}
