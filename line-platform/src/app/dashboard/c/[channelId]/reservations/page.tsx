import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessChannel } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "予約済",
  cancelled: "キャンセル",
  no_show: "無断キャンセル",
};

export default async function ReservationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ when?: string }>;
}) {
  const { channelId } = await params;
  const { when } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ok = await canAccessChannel(user.id, user.role, channelId);
  if (!ok) redirect("/dashboard");

  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: channelId },
  });

  const now = new Date();
  const filter = when === "past"
    ? { endAt: { lt: now } }
    : when === "all"
    ? {}
    : { endAt: { gte: now } };

  const reservations = await prisma.reservation.findMany({
    where: { lineChannelId: channelId, ...filter },
    orderBy: { startAt: when === "past" ? "desc" : "asc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">予約一覧</h1>
        <Link
          href={`/dashboard/c/${channelId}/reservations/settings`}
          className="border px-3 py-1.5 rounded text-sm"
        >
          予約設定
        </Link>
      </div>

      {!settings?.isEnabled && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded">
          予約機能はまだ有効化されていません。
          <Link
            href={`/dashboard/c/${channelId}/reservations/settings`}
            className="underline ml-1"
          >
            設定画面で有効化
          </Link>
          してください。
        </div>
      )}

      <div className="flex gap-2 text-sm">
        <Link
          href={`/dashboard/c/${channelId}/reservations`}
          className={`px-3 py-1 rounded border ${!when || when === "" ? "bg-line text-white border-line" : "bg-white"}`}
        >
          今後の予約
        </Link>
        <Link
          href={`/dashboard/c/${channelId}/reservations?when=past`}
          className={`px-3 py-1 rounded border ${when === "past" ? "bg-line text-white border-line" : "bg-white"}`}
        >
          過去
        </Link>
        <Link
          href={`/dashboard/c/${channelId}/reservations?when=all`}
          className={`px-3 py-1 rounded border ${when === "all" ? "bg-line text-white border-line" : "bg-white"}`}
        >
          すべて
        </Link>
      </div>

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">日時</th>
              <th className="px-4 py-2 font-medium">メニュー</th>
              <th className="px-4 py-2 font-medium">顧客名</th>
              <th className="px-4 py-2 font-medium">電話</th>
              <th className="px-4 py-2 font-medium">きっかけ</th>
              <th className="px-4 py-2 font-medium">状態</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2">
                  {new Date(r.startAt).toLocaleString("ja-JP", {
                    timeZone: "Asia/Tokyo",
                    month: "2-digit",
                    day: "2-digit",
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-4 py-2">
                  {r.serviceName}
                  <span className="text-xs text-gray-500 ml-1">({r.durationMinutes}分)</span>
                </td>
                <td className="px-4 py-2">{r.customerName}</td>
                <td className="px-4 py-2">{r.customerPhone}</td>
                <td className="px-4 py-2 text-gray-500">{r.referralSource ?? "-"}</td>
                <td className="px-4 py-2">{STATUS_LABEL[r.status] ?? r.status}</td>
              </tr>
            ))}
            {reservations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-gray-500 text-center">
                  予約はありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
