import { prisma } from "@/lib/prisma";
import { executeBroadcast } from "@/lib/broadcast";

export type ChannelResult = { channelId: string; ok: boolean; error?: string };

// 作成済みキャンペーンの下書き／予約 Broadcast を、アカウントごとに並列で今すぐ実行する
export async function executeCampaignBroadcasts(
  campaignId: string,
  allowedChannelIds?: string[],
): Promise<ChannelResult[]> {
  const targets = await prisma.broadcast.findMany({
    where: {
      campaignId,
      status: { in: ["draft", "scheduled"] },
      ...(allowedChannelIds ? { lineChannelId: { in: allowedChannelIds } } : {}),
    },
    select: { id: true, lineChannelId: true },
  });
  const settled = await Promise.allSettled(targets.map((t) => executeBroadcast(t.id)));
  return settled.map((r, i) => ({
    channelId: targets[i].lineChannelId,
    ok: r.status === "fulfilled",
    error: r.status === "rejected" ? (r.reason instanceof Error ? r.reason.message : "unknown") : undefined,
  }));
}

// 予約中／下書きの配信を取り消す
export async function cancelCampaignBroadcasts(campaignId: string, allowedChannelIds?: string[]) {
  const r = await prisma.broadcast.updateMany({
    where: {
      campaignId,
      status: { in: ["draft", "scheduled"] },
      ...(allowedChannelIds ? { lineChannelId: { in: allowedChannelIds } } : {}),
    },
    data: { status: "cancelled" },
  });
  return r.count;
}

// 子 Broadcast の状態から、キャンペーン全体の表示用状態を決める
export function summarizeStatus(statuses: string[]): string {
  if (statuses.length === 0) return "draft";
  const has = (s: string) => statuses.includes(s);
  if (has("sending")) return "sending";
  if (has("scheduled")) return "scheduled";
  if (has("draft")) return "draft";
  const done = statuses.filter((s) => s === "sent").length;
  const bad = statuses.filter((s) => s === "failed").length;
  if (bad > 0 && done > 0) return "partial";
  if (bad > 0) return "failed";
  if (done > 0) return "sent";
  return "cancelled";
}

export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: "下書き",
  scheduled: "予約済",
  sending: "送信中",
  sent: "送信済",
  partial: "一部失敗",
  failed: "失敗",
  cancelled: "取消",
  skipped: "対象なし",
};
