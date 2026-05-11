import { Client, type Message } from "@line/bot-sdk";

export type { Message };

const channelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
export const lineConfig = {
  get channelAccessToken() {
    return process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
  },
  channelSecret,
};

let _client: Client | null = null;
function getClient(): Client {
  if (_client) return _client;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  _client = new Client({ channelAccessToken: token, channelSecret });
  return _client;
}

// LINE はマルチキャストの宛先上限が 500 件
const MULTICAST_LIMIT = 500;

export async function pushTo(userId: string, messages: Message[]) {
  return getClient().pushMessage(userId, messages);
}

export async function multicastTo(userIds: string[], messages: Message[]) {
  const chunks: string[][] = [];
  for (let i = 0; i < userIds.length; i += MULTICAST_LIMIT) {
    chunks.push(userIds.slice(i, i + MULTICAST_LIMIT));
  }
  const client = getClient();
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

export async function broadcastAll(messages: Message[]) {
  return getClient().broadcast(messages);
}

export async function getProfile(userId: string) {
  try {
    return await getClient().getProfile(userId);
  } catch (e) {
    console.warn("[line] getProfile failed", userId, e);
    return null;
  }
}
