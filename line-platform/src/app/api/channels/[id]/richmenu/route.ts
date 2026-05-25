import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { RichMenu, Action } from "@line/bot-sdk";
import { prisma } from "@/lib/prisma";
import { requireChannel } from "@/lib/permissions";
import {
  createRichMenu,
  setRichMenuImage,
  setDefaultRichMenu,
  deleteRichMenu,
} from "@/lib/line";
import { layoutBounds, richMenuSize } from "@/lib/richMenuLayout";

const Button = z.object({
  label: z.string().max(40),
  actionType: z.enum(["reservation", "uri", "message"]),
  value: z.string().max(1000).optional().default(""),
  bgColor: z.string().optional().default("#1ABC9C"),
  textColor: z.string().optional().default("#FFFFFF"),
});

const Body = z.object({
  size: z.enum(["large", "compact"]),
  layout: z.enum(["1", "2", "3", "4", "6"]),
  chatBarText: z.string().min(1).max(14),
  buttons: z.array(Button).min(1).max(6),
  imageBase64: z.string(), // data URL or raw base64 PNG
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }

  const body = Body.parse(await req.json());
  const bounds = layoutBounds(body.layout, body.size);
  if (body.buttons.length !== bounds.length) {
    return NextResponse.json(
      { error: `レイアウト「${body.layout}」にはボタンが ${bounds.length} 個必要です` },
      { status: 400 },
    );
  }

  // 予約サイト URL の解決
  const settings = await prisma.reservationSettings.findUnique({ where: { lineChannelId: id } });
  const origin = new URL(req.url).origin;
  const reservationUri =
    settings?.liffId
      ? `https://liff.line.me/${settings.liffId}`
      : `${origin}/liff/${id}`;

  // areas 構築
  const areas = body.buttons.map((b, i) => {
    let action: Action;
    if (b.actionType === "reservation") {
      action = { type: "uri", label: b.label.slice(0, 20), uri: reservationUri };
    } else if (b.actionType === "uri") {
      action = { type: "uri", label: b.label.slice(0, 20), uri: b.value };
    } else {
      action = { type: "message", label: b.label.slice(0, 20), text: b.value || b.label };
    }
    return { bounds: bounds[i], action };
  });

  const size = richMenuSize(body.size);
  const richMenu: RichMenu = {
    size,
    selected: true,
    name: `menu-${id.slice(0, 8)}-${Date.now()}`,
    chatBarText: body.chatBarText,
    areas,
  };

  // 画像デコード
  const base64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer = Buffer.from(base64, "base64");
  if (imageBuffer.length > 1024 * 1024) {
    return NextResponse.json({ error: "画像サイズが 1MB を超えています" }, { status: 400 });
  }

  try {
    // 既存があれば削除
    const existing = await prisma.richMenu.findUnique({ where: { lineChannelId: id } });
    if (existing?.lineRichMenuId) {
      await deleteRichMenu(id, existing.lineRichMenuId).catch(() => null);
    }

    // 作成 → 画像 → デフォルト設定
    const richMenuId = await createRichMenu(id, richMenu);
    await setRichMenuImage(id, richMenuId, imageBuffer, "image/png");
    await setDefaultRichMenu(id, richMenuId);

    // DB 保存
    await prisma.richMenu.upsert({
      where: { lineChannelId: id },
      create: {
        lineChannelId: id,
        size: body.size,
        layout: body.layout,
        chatBarText: body.chatBarText,
        buttons: body.buttons,
        lineRichMenuId: richMenuId,
        isApplied: true,
      },
      update: {
        size: body.size,
        layout: body.layout,
        chatBarText: body.chatBarText,
        buttons: body.buttons,
        lineRichMenuId: richMenuId,
        isApplied: true,
      },
    });

    return NextResponse.json({ ok: true, richMenuId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "リッチメニューの適用に失敗しました" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await requireChannel(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const existing = await prisma.richMenu.findUnique({ where: { lineChannelId: id } });
  if (existing?.lineRichMenuId) {
    await deleteRichMenu(id, existing.lineRichMenuId).catch(() => null);
  }
  await prisma.richMenu.update({
    where: { lineChannelId: id },
    data: { isApplied: false, lineRichMenuId: null },
  }).catch(() => null);
  return NextResponse.json({ ok: true });
}
