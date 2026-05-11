import { NextRequest, NextResponse } from "next/server";
import type { WebhookEvent } from "@line/bot-sdk";
import { verifyLineSignature } from "@/lib/signature";
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/line";
import { startScenariosForFollow } from "@/lib/scenario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  const skip = process.env.SKIP_LINE_SIGNATURE === "true";

  if (!skip && !verifyLineSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { events?: WebhookEvent[] } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const events = payload.events ?? [];
  // 200 を即返したいので、処理は順次（ただし全部 await）。LINE 側のリトライ仕様を考えると問題なし。
  await Promise.allSettled(events.map(handleEvent));
  return NextResponse.json({ ok: true });
}

async function handleEvent(event: WebhookEvent) {
  const userId = event.source.type === "user" ? event.source.userId : null;
  if (!userId) return;

  switch (event.type) {
    case "follow":
      await onFollow(userId);
      break;
    case "unfollow":
      await onUnfollow(userId);
      break;
    case "message":
      await onMessage(event, userId);
      break;
    default:
      // postback, beacon, etc は今は無視（拡張ポイント）
      break;
  }
}

async function onFollow(userId: string) {
  const profile = await getProfile(userId);
  const friend = await prisma.friend.upsert({
    where: { lineUserId: userId },
    create: {
      lineUserId: userId,
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
      language: profile?.language,
      isFollowing: true,
    },
    update: {
      displayName: profile?.displayName,
      pictureUrl: profile?.pictureUrl,
      statusMessage: profile?.statusMessage,
      language: profile?.language,
      isFollowing: true,
      followedAt: new Date(),
      unfollowedAt: null,
    },
  });

  await startScenariosForFollow(friend.id);
}

async function onUnfollow(userId: string) {
  await prisma.friend.update({
    where: { lineUserId: userId },
    data: { isFollowing: false, unfollowedAt: new Date() },
  }).catch(() => {
    // 未登録ユーザーが unfollow するケースはレース。無視。
  });
}

async function onMessage(event: Extract<WebhookEvent, { type: "message" }>, userId: string) {
  const friend = await prisma.friend.upsert({
    where: { lineUserId: userId },
    create: {
      lineUserId: userId,
      isFollowing: true,
      lastMessageAt: new Date(),
    },
    update: { lastMessageAt: new Date() },
  });

  const msg = event.message;
  await prisma.inboundMessage.create({
    data: {
      friendId: friend.id,
      lineMessageId: msg.id,
      type: msg.type,
      text: msg.type === "text" ? msg.text : null,
      raw: msg as unknown as object,
    },
  });
}
