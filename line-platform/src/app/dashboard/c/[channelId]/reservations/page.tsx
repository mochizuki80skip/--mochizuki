import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, canAccessChannel } from "@/lib/permissions";
import { InquiryActions } from "./InquiryActions";
import { ReservationActions } from "./ReservationActions";

export const dynamic = "force-dynamic";

const RES_STATUS: Record<string, string> = {
  confirmed: "予約済",
  cancelled: "キャンセル",
  no_show: "無断キャンセル",
};
const INQ_STATUS: Record<string, string> = {
  pending: "未対応",
  handled: "対応済",
  cancelled: "キャンセル",
};
const VISIT: Record<string, string> = { new: "新規", returning: "2回目以降" };

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

  if (!settings?.isEnabled) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">予約管理</h1>
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded">
          予約機能はまだ有効化されていません。
          <Link href={`/dashboard/c/${channelId}/reservations/settings`} className="underline ml-1">
            設定画面で有効化
          </Link>
          してください。
        </div>
      </div>
    );
  }

  // === シート連動モード: 問い合わせ一覧を表示 ===
  if (settings.sheetLinkedMode) {
    const filterInq =
      when === "handled" ? { status: "handled" } : when === "all" ? {} : { status: "pending" };
    const inquiries = await prisma.inquiry.findMany({
      where: { lineChannelId: channelId, ...filterInq },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const now = new Date();
    const upcoming = await prisma.reservation.findMany({
      where: { lineChannelId: channelId, status: "confirmed", endAt: { gte: now } },
      orderBy: { startAt: "asc" },
      take: 100,
    });

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">予約管理</h1>
          <div className="flex gap-2">
            <Link href={`/dashboard/c/${channelId}/reservations/roster`} className="border px-3 py-1.5 rounded text-sm">
              ベッド担当
            </Link>
            <Link href={`/dashboard/c/${channelId}/reservations/settings`} className="border px-3 py-1.5 rounded text-sm">
              予約設定
            </Link>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs p-3 rounded">
          お客様からの予約リクエスト一覧です。「確定する」で日時・ベッドを指定すると確定予約になり、スプレッドシートの当日タブにも書き出します。
          確定後は下の「確定済みの予約」から公式LINEで案内を送信できます。
        </div>

        <div className="flex gap-2 text-sm">
          {[
            { k: "", label: "未対応" },
            { k: "handled", label: "対応済" },
            { k: "all", label: "すべて" },
          ].map((t) => (
            <Link
              key={t.k}
              href={`/dashboard/c/${channelId}/reservations${t.k ? `?when=${t.k}` : ""}`}
              className={`px-3 py-1 rounded border ${(when ?? "") === t.k ? "bg-line text-white border-line" : "bg-white"}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        <div className="bg-white border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">受付</th>
                <th className="px-4 py-2 font-medium">希望日時</th>
                <th className="px-4 py-2 font-medium">区分</th>
                <th className="px-4 py-2 font-medium">お名前</th>
                <th className="px-4 py-2 font-medium">電話</th>
                <th className="px-4 py-2 font-medium">きっかけ</th>
                <th className="px-4 py-2 font-medium">状態</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((q) => {
                const prefs = (q.preferences as { date: string; time: string }[] | null) ?? [
                  { date: q.date, time: q.time },
                ];
                return (
                <tr key={q.id} className="border-t">
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(q.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2">
                    {prefs.map((p, i) => (
                      <div key={i} className={i === 0 ? "font-medium" : "text-xs text-gray-500"}>
                        第{i + 1}: {p.date.slice(5).replace("-", "/")} {p.time}
                      </div>
                    ))}
                  </td>
                  <td className="px-4 py-2">{VISIT[q.visitType] ?? q.visitType}</td>
                  <td className="px-4 py-2">{q.customerName}</td>
                  <td className="px-4 py-2">{q.customerPhone || "-"}</td>
                  <td className="px-4 py-2 text-gray-500">{q.referralSource ?? "-"}</td>
                  <td className="px-4 py-2">{INQ_STATUS[q.status] ?? q.status}</td>
                  <td className="px-4 py-2 text-right">
                    <InquiryActions
                      channelId={channelId}
                      inquiryId={q.id}
                      status={q.status}
                      visitType={q.visitType}
                      prefs={prefs}
                    />
                  </td>
                </tr>
                );
              })}
              {inquiries.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-sm text-gray-500 text-center">該当するリクエストはありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <h2 className="text-lg font-semibold pt-2">確定済みの予約（今後）</h2>
        <div className="bg-white border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">日時</th>
                <th className="px-4 py-2 font-medium">区分</th>
                <th className="px-4 py-2 font-medium">ベッド</th>
                <th className="px-4 py-2 font-medium">お名前</th>
                <th className="px-4 py-2 font-medium">電話</th>
                <th className="px-4 py-2 font-medium">LINE案内</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">
                    {new Date(r.startAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2">{VISIT[r.visitType ?? ""] ?? r.serviceName}</td>
                  <td className="px-4 py-2">
                    {r.bedNumber != null ? `#${r.bedNumber}` : "-"}
                    {r.therapistName ? <span className="text-xs text-gray-500 ml-1">{r.therapistName}</span> : null}
                  </td>
                  <td className="px-4 py-2">{r.customerName}</td>
                  <td className="px-4 py-2">{r.customerPhone || "-"}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {r.confirmSentAt
                      ? `送信済 ${new Date(r.confirmSentAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                      : "未送信"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <ReservationActions
                      channelId={channelId}
                      reservationId={r.id}
                      hasLineUser={!!r.lineUserId}
                      alreadySent={!!r.confirmSentAt}
                    />
                  </td>
                </tr>
              ))}
              {upcoming.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-sm text-gray-500 text-center">確定済みの予約はありません。</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // === DB モード: 予約一覧 ===
  const now = new Date();
  const filter = when === "past" ? { endAt: { lt: now } } : when === "all" ? {} : { endAt: { gte: now } };
  const reservations = await prisma.reservation.findMany({
    where: { lineChannelId: channelId, ...filter },
    orderBy: { startAt: when === "past" ? "desc" : "asc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">予約一覧</h1>
        <Link href={`/dashboard/c/${channelId}/reservations/settings`} className="border px-3 py-1.5 rounded text-sm">
          予約設定
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        {[
          { k: "", label: "今後の予約" },
          { k: "past", label: "過去" },
          { k: "all", label: "すべて" },
        ].map((t) => (
          <Link
            key={t.k}
            href={`/dashboard/c/${channelId}/reservations${t.k ? `?when=${t.k}` : ""}`}
            className={`px-3 py-1 rounded border ${(when ?? "") === t.k ? "bg-line text-white border-line" : "bg-white"}`}
          >
            {t.label}
          </Link>
        ))}
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
                  {new Date(r.startAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2">{r.serviceName}<span className="text-xs text-gray-500 ml-1">({r.durationMinutes}分)</span></td>
                <td className="px-4 py-2">{r.customerName}</td>
                <td className="px-4 py-2">{r.customerPhone}</td>
                <td className="px-4 py-2 text-gray-500">{r.referralSource ?? "-"}</td>
                <td className="px-4 py-2">{RES_STATUS[r.status] ?? r.status}</td>
              </tr>
            ))}
            {reservations.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-sm text-gray-500 text-center">予約はありません。</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
