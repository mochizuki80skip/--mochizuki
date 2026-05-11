import { NextRequest, NextResponse } from "next/server";
import type { WebhookEvent } from "@line/bot-sdk";
import { verifyLineSignature } from "@/lib/signature";
import { prisma } from "@/lib/prisma";
import { getProfile, getChannelSecret } from "@/lib/line";
import { startScenariosForFollow } from "@/lib/scenario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;

  // 該当チャネルの存在確認
  const channel = await prisma.lineChannel.findUnique({
    where: { id: channelId },
    select: { id: true, isActive: true, channelSecret: true },
  });
  if (!channel) return NextResponse.json({ error: "channel not found" }, { status: 404 });
  if (!channel.isActive) return NextResponse.json({ error: "channel inactive" }, { status: 403 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  const skip = process.env.SKIP_LINE_SIGNATURE === "true";

  if (!skip && !verifyLineSignature(rawBody, signature, channel.channelSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: { events?: WebhookEvent[] } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const events = payload.events ?? [];
  await Promise.allSettled(events.map((ev) => handleEvent(channelId, ev)));
  return NextResponse.json({ ok: true });
}

async function handleEvent(channelId: string, event: WebhookEvent) {
  const userId = event.source.type === "user" ? event.source.userId : null;
  if (!userId) return;

  switch (event.type) {
    case "follow":
      await onFollow(channelId, userId);
      break;
    case "unfollow":
      await onUnfollow(channelId, userId);
      break;
    case "message":
      await onMessage(channelId, event, userId);
      break;
    default:
      break;
  }
}

async function onFollow(channelId: string, userId: string) {
  const profile = await getProfile(channelId, userId);
  const friend = await prisma.friend.upsert({
    where: { lineChannelId_lineUserId: { lineChannelId: channelId, lineUserId: userId } },
    create: {
      lineChannelId: channelId,
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

  await startScenariosForFollow(channelId, friend.id);
}

async function onUnfollow(channelId: string, userId: string) {
  await prisma.friend
    .update({
      where: { lineChannelId_lineUserId: { lineChannelId: channelId, lineUserId: userId } },
      data: { isFollowing: false, unfollowedAt: new Date() },
    })
    .catch(() => null);
}

async function onMessage(
  channelId: string,
  event: Extract<WebhookEvent, { type: "message" }>,
  userId: string,
) {
  const friend = await prisma.friend.upsert({
    where: { lineChannelId_lineUserId: { lineChannelId: channelId, lineUserId: userId } },
    create: {
      lineChannelId: channelId,
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
