// 確定予約の案内を公式LINEで送信
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import { pushTo } from "@/lib/line";

const DEFAULT_TEMPLATE =
  "{name}様\nご予約が確定しました。\n\n日時：{date} {time}\nメニュー：{menu}\n\nご来院をお待ちしております。";

function fmtDate(d: Date): { date: string; time: string } {
  const date = d.toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const time = d.toLocaleTimeString("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { date, time };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; reservationId: string }> },
) {
  const { id, reservationId } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const reservation = await prisma.reservation.findFirst({
    where: { id: reservationId, lineChannelId: id },
  });
  if (!reservation) {
    return NextResponse.json({ error: "予約が見つかりません" }, { status: 404 });
  }
  if (!reservation.lineUserId) {
    return NextResponse.json(
      { error: "LINE userId が無いため送信できません（LIFF 経由でない予約）" },
      { status: 400 },
    );
  }

  const settings = await prisma.reservationSettings.findUnique({ where: { lineChannelId: id } });
  const template = settings?.confirmMessageTemplate || DEFAULT_TEMPLATE;
  const { date, time } = fmtDate(reservation.startAt);
  const text = template
    .replace(/\{name\}/g, reservation.customerName)
    .replace(/\{date\}/g, date)
    .replace(/\{time\}/g, time)
    .replace(/\{menu\}/g, reservation.serviceName);

  try {
    await pushTo(id, reservation.lineUserId, [{ type: "text", text }]);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "送信に失敗しました" },
      { status: 502 },
    );
  }

  await prisma.reservation.update({
    where: { id: reservationId },
    data: { confirmSentAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
