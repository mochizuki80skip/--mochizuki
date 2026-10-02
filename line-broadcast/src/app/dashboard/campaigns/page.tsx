import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getCurrentUser, listAccessibleChannels } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { CAMPAIGN_STATUS_LABEL, summarizeStatus } from "@/lib/campaign";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const accessible = (await listAccessibleChannels(user.id, user.role)).map((c) => c.id);

  const campaigns = await prisma.campaign.findMany({
    where: user.role === "super_admin" ? {} : { broadcasts: { some: { lineChannelId: { in: accessible } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { broadcasts: { select: { status: true, lineChannelId: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">一括配信</h1>
        <Link href="/dashboard/campaigns/new" className="bg-line text-white px-3 py-1.5 rounded text-sm flex items-center gap-1">
          <Plus size={14} /> 新規作成
        </Link>
      </div>
      <div className="bg-white border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">タイトル</th>
              <th className="px-4 py-2 font-medium">状態</th>
              <th className="px-4 py-2 font-medium">アカウント数</th>
              <th className="px-4 py-2 font-medium">対象</th>
              <th className="px-4 py-2 font-medium">配信日時</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const status = summarizeStatus(c.broadcasts.map((b) => b.status));
              const tagNames = c.audienceTagNames as string[];
              return (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2">{c.title}</td>
                  <td className="px-4 py-2">{CAMPAIGN_STATUS_LABEL[status] ?? status}</td>
                  <td className="px-4 py-2">{c.broadcasts.length}</td>
                  <td className="px-4 py-2 text-gray-600">{tagNames.length ? tagNames.join("、") : "全員"}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {(c.scheduledAt ?? c.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link href={`/dashboard/campaigns/${c.id}`} className="text-line-dark hover:underline">
                      詳細
                    </Link>
                  </td>
                </tr>
              );
            })}
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-gray-500">
                  一括配信はまだありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
