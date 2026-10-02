import { notFound, redirect } from "next/navigation";
import { getCurrentUser, listAccessibleChannels } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CAMPAIGN_STATUS_LABEL, summarizeStatus } from "@/lib/campaign";
import type { BlockInput } from "@/lib/campaign-blocks";
import { BlockPreview } from "@/components/message/BlockPreview";
import { CampaignActions } from "./CampaignActions";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) => (d ? d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) : "-");

export default async function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;

  const accessible = new Set((await listAccessibleChannels(user.id, user.role)).map((c) => c.id));
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { broadcasts: { include: { lineChannel: { select: { name: true, color: true } } }, orderBy: { createdAt: "asc" } } },
  });
  if (!campaign) notFound();
  // 自分がアクセスできるアカウント分だけ表示する
  const broadcasts = campaign.broadcasts.filter((b) => accessible.has(b.lineChannelId));
  if (broadcasts.length === 0 && user.role !== "super_admin") notFound();

  const status = summarizeStatus(broadcasts.map((b) => b.status));
  const tagNames = campaign.audienceTagNames as string[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{campaign.title}</h1>
        <div className="text-sm text-gray-500 mt-1">
          状態：{CAMPAIGN_STATUS_LABEL[status] ?? status} ／ 対象：{tagNames.length ? `タグ ${tagNames.join("、")}` : "友だち全員"} ／ 予約：
          {fmt(campaign.scheduledAt)}
        </div>
      </div>

      <CampaignActions
        id={campaign.id}
        targetCount={broadcasts.filter((b) => b.status === "draft" || b.status === "scheduled").length}
        canSend={broadcasts.some((b) => b.status === "draft" || b.status === "scheduled")}
        canCancel={broadcasts.some((b) => b.status === "draft" || b.status === "scheduled")}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className="bg-white border rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">アカウント</th>
                <th className="px-4 py-2 font-medium">状態</th>
                <th className="px-4 py-2 font-medium">対象人数</th>
                <th className="px-4 py-2 font-medium">送信日時</th>
              </tr>
            </thead>
            <tbody>
              {broadcasts.map((b) => (
                <tr key={b.id} className="border-t align-top">
                  <td className="px-4 py-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: b.lineChannel.color }} />
                    {b.lineChannel.name}
                  </td>
                  <td className="px-4 py-2">
                    {CAMPAIGN_STATUS_LABEL[b.status] ?? b.status}
                    {b.errorMessage && <div className="text-xs text-red-600 mt-0.5 whitespace-pre-wrap">{b.errorMessage}</div>}
                  </td>
                  <td className="px-4 py-2">{b.status === "sent" || b.status === "failed" ? b.totalTargets : "-"}</td>
                  <td className="px-4 py-2 text-gray-500">{fmt(b.sentAt ?? b.scheduledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <BlockPreview blocks={campaign.blocks as unknown as BlockInput[]} />
      </div>
    </div>
  );
}
