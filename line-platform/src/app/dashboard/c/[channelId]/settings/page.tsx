import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Calendar } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { ChannelSettingsForm } from "./ChannelSettingsForm";
import { MembersList } from "./MembersList";
import { WebhookUrl } from "./WebhookUrl";

export const dynamic = "force-dynamic";

export default async function ChannelSettingsPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const channel = await prisma.lineChannel.findUnique({ where: { id: channelId } });
  if (!channel) notFound();

  const memberships = await prisma.channelMembership.findMany({
    where: { lineChannelId: channelId },
    include: { adminUser: true },
    orderBy: { createdAt: "asc" },
  });

  const reservationSettings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
    select: { isEnabled: true },
  });

  const isSuperAdmin = user.role === "super_admin";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">設定 — {channel.name}</h1>

      {!isSuperAdmin && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded">
          設定の変更は管理者（super_admin）のみ可能です。
        </div>
      )}

      <WebhookUrl channelId={channelId} />

      <ChannelSettingsForm
        channelId={channel.id}
        initial={{
          name: channel.name,
          description: channel.description ?? "",
          color: channel.color,
          isActive: channel.isActive,
        }}
        readOnly={!isSuperAdmin}
      />

      <div className="bg-white border rounded p-5">
        <div className="flex items-start gap-3">
          <Calendar size={24} className="text-line-dark mt-0.5" />
          <div className="flex-1">
            <div className="font-medium">予約機能（オプション）</div>
            <div className="text-sm text-gray-600 mt-1">
              {reservationSettings?.isEnabled
                ? "✅ この LINE で予約機能が有効になっています。"
                : "接骨院・サロン等の予約受付に使えます。LIFF カレンダーから予約 → スプレッドシートに自動記録。"}
            </div>
          </div>
          <Link
            href={`/dashboard/c/${channelId}/reservations/settings`}
            className="border px-3 py-1.5 rounded text-sm shrink-0"
          >
            {reservationSettings?.isEnabled ? "予約設定を開く" : "予約機能を設定"}
          </Link>
        </div>
      </div>

      <MembersList
        channelId={channel.id}
        members={memberships.map((m) => ({
          adminUserId: m.adminUserId,
          email: m.adminUser.email,
          name: m.adminUser.name,
          role: m.role,
        }))}
        readOnly={!isSuperAdmin}
      />
    </div>
  );
}
