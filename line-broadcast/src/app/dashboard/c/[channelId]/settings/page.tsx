import { redirect, notFound } from "next/navigation";
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
