import { Client, type Message } from "@line/bot-sdk";

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";

if (!channelAccessToken && process.env.NODE_ENV !== "test") {
  console.warn("[line] LINE_CHANNEL_ACCESS_TOKEN is not set");
}

export const lineConfig = { channelAccessToken, channelSecret };

export const lineClient = new Client(lineConfig);

export type { Message };

// LINE はマルチキャストの宛先上限が 500 件
const MULTICAST_LIMIT = 500;

export async function pushTo(userId: string, messages: Message[]) {
  return lineClient.pushMessage(userId, messages);
}

export async function multicastTo(userIds: string[], messages: Message[]) {
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += MULTICAST_LIMIT) {
    chunks.push(userIds.slice(i, i + MULTICAST_LIMIT));
  }
  const results = await Promise.allSettled(
    chunks.map((chunk) => lineClient.multicast(chunk, messages)),
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

export async function broadcastAll(messages: Message[]) {
  return lineClient.broadcast(messages);
}

export async function getProfile(userId: string) {
  try {
    return await lineClient.getProfile(userId);
  } catch (e) {
    console.warn("[line] getProfile failed", userId, e);
    return null;
  }
}
