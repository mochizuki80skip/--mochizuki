import { Client, type Message } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";

export type { Message };

const MULTICAST_LIMIT = 500;

// チャネル ID からクライアントを構築（メモリキャッシュ）
const clientCache = new Map<string, Client>();

async function getClientByChannelId(channelId: string): Promise<{ client: Client; channelSecret: string }> {
  const cached = clientCache.get(channelId);
  const ch = await prisma.lineChannel.findUnique({
    where: { id: channelId },
    select: { channelAccessToken: true, channelSecret: true, isActive: true },
  });
  if (!ch) throw new Error(`channel not found: ${channelId}`);
  if (!ch.isActive) throw new Error(`channel inactive: ${channelId}`);

  if (cached) return { client: cached, channelSecret: ch.channelSecret };

  const client = new Client({
    channelAccessToken: ch.channelAccessToken,
    channelSecret: ch.channelSecret,
  });
  clientCache.set(channelId, client);
  return { client, channelSecret: ch.channelSecret };
}

// キャッシュ無効化（トークン更新時に呼ぶ）
export function invalidateClientCache(channelId: string) {
  clientCache.delete(channelId);
}

export async function getChannelSecret(channelId: string): Promise<string> {
  const ch = await prisma.lineChannel.findUnique({
    where: { id: channelId },
    select: { channelSecret: true },
  });
  if (!ch) throw new Error(`channel not found: ${channelId}`);
  return ch.channelSecret;
}

export async function pushTo(channelId: string, userId: string, messages: Message[]) {
  const { client } = await getClientByChannelId(channelId);
  return client.pushMessage(userId, messages);
}

export async function multicastTo(channelId: string, userIds: string[], messages: Message[]) {
  const { client } = await getClientByChannelId(channelId);
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += MULTICAST_LIMIT) {
    chunks.push(userIds.slice(i, i + MULTICAST_LIMIT));
  }
  const results = await Promise.allSettled(
    chunks.map((chunk) => client.multicast(chunk, messages)),
  );
  const success = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected");
  return {
    totalChunks: chunks.length,
    successChunks: success,
    failedChunks: failed.length,
    errors: failed.map((r) => (r as PromiseRejectedResult).reason?.message ?? "unknown"),
  };
}

export async function broadcastAll(channelId: string, messages: Message[]) {
  const { client } = await getClientByChannelId(channelId);
  return client.broadcast(messages);
}

export async function getProfile(channelId: string, userId: string) {
  try {
    const { client } = await getClientByChannelId(channelId);
    return await client.getProfile(userId);
  } catch (e) {
    console.warn(`[line] getProfile failed channel=${channelId} user=${userId}`, e);
    return null;
  }
}

// トークン検証用：与えられたトークン/シークレットで profile を取得できるか
export async function verifyChannelCredentials(channelAccessToken: string, channelSecret: string) {
  const c = new Client({ channelAccessToken, channelSecret });
  try {
    await c.getBotInfo();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "unknown" };
  }
}

// 応答メッセージ（replyToken を使う送信）。
// 友だち追加・メッセージ受信・ポストバック等の Webhook イベントに対する返信は
// 月間メッセージ通数（無料/有料枠）にカウントされない。
export async function replyTo(channelId: string, replyToken: string, messages: Message[]) {
  const { client } = await getClientByChannelId(channelId);
  return client.replyMessage(replyToken, messages.slice(0, 5));
}

export type QuotaSummary = {
  limit: number | null; // null = 上限なし（従量課金で上限未設定）
  used: number;
  remaining: number | null;
};

// 今月の送信枠（上限・消費数・残り）を LINE API から取得
export async function getQuotaSummary(channelId: string): Promise<QuotaSummary | null> {
  try {
    const { client } = await getClientByChannelId(channelId);
    const [quota, usage] = await Promise.all([
      client.getTargetLimitForAdditionalMessages(),
      client.getNumberOfMessagesSentThisMonth(),
    ]);
    const limit = quota.type === "limited" ? quota.value ?? null : null;
    return {
      limit,
      used: usage.totalUsage,
      remaining: limit === null ? null : Math.max(0, limit - usage.totalUsage),
    };
  } catch (e) {
    console.warn(`[line] getQuotaSummary failed channel=${channelId}`, e);
    return null;
  }
}
