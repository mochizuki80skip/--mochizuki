import type { Message } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { replyTo } from "@/lib/line";

// 受信テキスト / ポストバック data に一致する自動応答を探す
export async function findAutoReply(channelId: string, input: string) {
  const text = input.trim();
  if (!text) return null;
  const rules = await prisma.autoReply.findMany({
    where: { lineChannelId: channelId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  // 完全一致を部分一致より優先
  return (
    rules.find((r) => r.matchType === "exact" && r.keyword === text) ??
    rules.find((r) => r.matchType === "contains" && text.includes(r.keyword)) ??
    null
  );
}

// 一致する自動応答があれば replyToken で返信する（通数にカウントされない）
export async function replyByKeyword(channelId: string, friendId: string, replyToken: string, input: string) {
  const rule = await findAutoReply(channelId, input);
  if (!rule) return false;
  try {
    await replyTo(channelId, replyToken, rule.messages as unknown as Message[]);
    await prisma.deliveryLog.create({
      data: { lineChannelId: channelId, friendId, channel: "reply", status: "success" },
    });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await prisma.deliveryLog.create({
      data: { lineChannelId: channelId, friendId, channel: "reply", status: "failed", errorMessage: msg },
    });
    return false;
  }
}

// 友だち追加直後に送る予定（ディレイ 0 分）のステップを、push ではなく
// follow イベントの replyToken でまとめて送る。失敗したら pending に戻し、
// 従来どおりワーカーの push で送られる。
export async function replyImmediateScenarioSteps(channelId: string, friendId: string, replyToken: string) {
  const now = new Date();
  const due = await prisma.scenarioRunStep.findMany({
    where: { status: "pending", scheduledAt: { lte: now }, run: { friendId } },
    include: { step: true },
    orderBy: { scheduledAt: "asc" },
  });

  // reply は 1 回・最大 5 吹き出しまで。収まる分だけ送る
  const picked: typeof due = [];
  const messages: Message[] = [];
  for (const rs of due) {
    const m = rs.step.messages as unknown as Message[];
    if (messages.length + m.length > 5) break;
    picked.push(rs);
    messages.push(...m);
  }
  if (picked.length === 0) return 0;

  const ids = picked.map((rs) => rs.id);
  // ワーカーとの二重送信を防ぐため先に確保
  const claimed = await prisma.scenarioRunStep.updateMany({
    where: { id: { in: ids }, status: "pending" },
    data: { status: "sending" },
  });
  if (claimed.count !== ids.length) {
    await prisma.scenarioRunStep.updateMany({
      where: { id: { in: ids }, status: "sending" },
      data: { status: "pending" },
    });
    return 0;
  }

  try {
    await replyTo(channelId, replyToken, messages);
  } catch (e) {
    console.warn("[autoReply] follow reply failed, fallback to push", e);
    await prisma.scenarioRunStep.updateMany({
      where: { id: { in: ids } },
      data: { status: "pending" },
    });
    return 0;
  }

  await prisma.scenarioRunStep.updateMany({
    where: { id: { in: ids } },
    data: { status: "sent", sentAt: new Date() },
  });
  await prisma.deliveryLog.create({
    data: { lineChannelId: channelId, friendId, channel: "reply", status: "success" },
  });
  return picked.length;
}
