import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessChannel } from "@/lib/permissions";
import { RichMenuEditor } from "./RichMenuEditor";

export const dynamic = "force-dynamic";

type ButtonConfig = {
  label: string;
  actionType: "reservation" | "uri" | "message";
  value: string;
  bgColor: string;
  textColor: string;
};

export default async function RichMenuPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ok = await canAccessChannel(user.id, user.role, channelId);
  if (!ok) redirect("/dashboard");

  const rm = await prisma.richMenu.findUnique({ where: { lineChannelId: channelId } });

  const initial = rm
    ? {
        size: rm.size as "large" | "compact",
        layout: rm.layout as "1" | "2" | "3" | "4" | "6",
        chatBarText: rm.chatBarText,
        buttons: rm.buttons as ButtonConfig[],
        isApplied: rm.isApplied,
      }
    : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">リッチメニュー</h1>
      <p className="text-sm text-gray-600">
        トーク画面下部に表示されるメニューです。ボタンを設定して「適用」を押すと、
        画像が自動生成されて LINE に登録されます（デザイン不要）。
      </p>
      <RichMenuEditor channelId={channelId} initial={initial} />
    </div>
  );
}
