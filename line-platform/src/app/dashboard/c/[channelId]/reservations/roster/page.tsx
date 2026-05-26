import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessChannel } from "@/lib/permissions";
import { RosterEditor } from "./RosterEditor";

export const dynamic = "force-dynamic";

export default async function RosterPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ok = await canAccessChannel(user.id, user.role, channelId);
  if (!ok) redirect("/dashboard");

  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
  });
  if (!settings?.isEnabled) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">ベッド担当（日次）</h1>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded">
          予約機能が有効化されていません。
          <Link href={`/dashboard/c/${channelId}/reservations/settings`} className="underline ml-1">
            設定画面
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">ベッド担当（日次）</h1>
        <Link href={`/dashboard/c/${channelId}/reservations`} className="border px-3 py-1.5 rounded text-sm">
          予約管理に戻る
        </Link>
      </div>
      <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs p-3 rounded">
        日付ごとに、その日担当する施術者とベッドを登録します。空き状況の自動計算と確定時のベッド選択に使われます。
        「新規対応」にチェックを入れたベッドのみ、新規（30分）の予約を受け付けます。
      </div>
      <RosterEditor channelId={channelId} defaultBedCount={settings.defaultBedCount} />
    </div>
  );
}
