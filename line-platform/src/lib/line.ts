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

// Bot の基本情報（basicId など）
export async function getBotInfo(channelId: string) {
  const { client } = await getClientByChannelId(channelId);
  return client.getBotInfo();
}

// 基本ID を取得して未保存なら DB に保存
export async function ensureBasicId(channelId: string): Promise<string | null> {
  const ch = await prisma.lineChannel.findUnique({
    where: { id: channelId },
    select: { lineBasicId: true },
  });
  if (ch?.lineBasicId) return ch.lineBasicId;
  try {
    const info = await getBotInfo(channelId);
    const basicId = info.basicId ?? null;
    if (basicId) {
      await prisma.lineChannel.update({ where: { id: channelId }, data: { lineBasicId: basicId } });
    }
    return basicId;
  } catch (e) {
    console.warn("[line] getBotInfo failed", channelId, e);
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

// === リッチメニュー ===
import type { RichMenu } from "@line/bot-sdk";

export async function listRichMenus(channelId: string) {
  const { client } = await getClientByChannelId(channelId);
  return client.getRichMenuList();
}

export async function createRichMenu(channelId: string, richMenu: RichMenu): Promise<string> {
  const { client } = await getClientByChannelId(channelId);
  return client.createRichMenu(richMenu);
}

export async function setRichMenuImage(
  channelId: string,
  richMenuId: string,
  image: Buffer,
  contentType: "image/png" | "image/jpeg",
) {
  const { client } = await getClientByChannelId(channelId);
  return client.setRichMenuImage(richMenuId, image, contentType);
}

export async function setDefaultRichMenu(channelId: string, richMenuId: string) {
  const { client } = await getClientByChannelId(channelId);
  return client.setDefaultRichMenu(richMenuId);
}

export async function deleteRichMenu(channelId: string, richMenuId: string) {
  const { client } = await getClientByChannelId(channelId);
  return client.deleteRichMenu(richMenuId);
}
