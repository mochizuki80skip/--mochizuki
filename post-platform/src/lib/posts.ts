import type { Store, PostBatch, Post } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generatePost } from "@/lib/ai";
import { checkPost, hasError, splitLines, type Flag } from "@/lib/compliance";
import { createLocalPost } from "@/lib/google";
import { publishImage, refreshToken } from "@/lib/instagram";
import { decrypt, encrypt } from "@/lib/crypto";
import { THEMES, jstParts, jstDate } from "@/lib/themes";

export async function getSettings() {
  return prisma.settings.upsert({ where: { id: "default" }, create: {}, update: {} });
}

// 店舗ごとに使える媒体
export function storeChannels(s: Pick<Store, "gbpEnabled" | "gbpAccountId" | "gbpLocationId" | "igEnabled" | "igUserId" | "igAccessToken">) {
  return {
    gbp: s.gbpEnabled && !!s.gbpAccountId && !!s.gbpLocationId,
    instagram: s.igEnabled && !!s.igUserId && !!s.igAccessToken,
  };
}

// 画像：投稿個別 > 回の共通画像 > 店舗の写真を順番に
function pickImage(store: Store, batch: PostBatch, seq: number) {
  if (batch.imageUrl) return batch.imageUrl;
  const photos = splitLines(store.photoUrls);
  return photos.length ? photos[seq % photos.length] : null;
}

// ---------- 作成 ----------
export async function createBatch(input: { theme: string; memo?: string; scheduledAt: Date; imageUrl?: string | null }) {
  const stores = await prisma.store.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const targets = stores.filter((s) => {
    const ch = storeChannels(s);
    return ch.gbp || ch.instagram;
  });
  const seq = await prisma.postBatch.count();
  const batch = await prisma.postBatch.create({
    data: { theme: input.theme, memo: input.memo ?? "", scheduledAt: input.scheduledAt, imageUrl: input.imageUrl || null },
  });
  await prisma.post.createMany({
    data: targets.map((s) => ({ batchId: batch.id, storeId: s.id, imageUrl: pickImage(s, batch, seq) })),
  });
  return batch;
}

// 翌週（月〜日）の投稿曜日ぶんの回を作成。テーマは順番に回す
export async function createNextWeek(now = new Date()) {
  const settings = await getSettings();
  const { year, month, day, weekday } = jstParts(now);
  const daysToMonday = ((8 - weekday) % 7) || 7;
  let cursor = settings.themeCursor;
  const created: PostBatch[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(year, month - 1, day + daysToMonday + i));
    if (!settings.postingDays.includes(d.getUTCDay())) continue;
    const at = jstDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), settings.postingTime);
    const exists = await prisma.postBatch.findFirst({ where: { scheduledAt: at } });
    if (exists) continue;
    created.push(await createBatch({ theme: THEMES[cursor % THEMES.length], scheduledAt: at }));
    cursor++;
  }
  await prisma.settings.update({ where: { id: "default" }, data: { themeCursor: cursor } });
  return created;
}

// ---------- AI 生成 ----------
async function flagsFor(post: Pick<Post, "gbpText" | "igCaption">, store: Store) {
  const settings = await getSettings();
  return checkPost(post, { ...storeChannels(store), extraNgWords: splitLines(settings.extraNgWords) });
}

// 未生成の投稿を最大 limit 件生成する（Vercel の実行時間制限があるため小分けに呼ぶ）
export async function generatePending(batchId: string, limit = 6) {
  const settings = await getSettings();
  const batch = await prisma.postBatch.findUniqueOrThrow({ where: { id: batchId } });
  const pending = await prisma.post.findMany({
    where: { batchId, status: "pending" },
    include: { store: true },
    take: limit,
  });

  await Promise.all(
    pending.map(async (p) => {
      try {
        const ch = storeChannels(p.store);
        const out = await generatePost({
          store: { name: p.store.name, area: p.store.area, features: p.store.features, hashtags: p.store.igHashtags },
          theme: batch.theme,
          memo: batch.memo,
          scheduledAt: batch.scheduledAt,
          commonHashtags: settings.commonHashtags,
          withInstagram: ch.instagram,
        });
        const draft = { gbpText: out.gbp, igCaption: out.instagram };
        await prisma.post.update({
          where: { id: p.id },
          data: { ...draft, status: "draft", error: null, flags: await flagsFor(draft, p.store) },
        });
      } catch (e) {
        await prisma.post.update({ where: { id: p.id }, data: { error: e instanceof Error ? e.message : "unknown" } });
      }
    }),
  );

  const remaining = await prisma.post.count({ where: { batchId, status: "pending", error: null } });
  return { processed: pending.length, remaining };
}

export async function regenerate(postId: string) {
  await prisma.post.update({ where: { id: postId }, data: { status: "pending", error: null } });
  const p = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  const settings = await getSettings();
  const batch = await prisma.postBatch.findUniqueOrThrow({ where: { id: p.batchId } });
  const store = await prisma.store.findUniqueOrThrow({ where: { id: p.storeId } });
  const out = await generatePost({
    store: { name: store.name, area: store.area, features: store.features, hashtags: store.igHashtags },
    theme: batch.theme,
    memo: batch.memo,
    scheduledAt: batch.scheduledAt,
    commonHashtags: settings.commonHashtags,
    withInstagram: storeChannels(store).instagram,
  });
  const draft = { gbpText: out.gbp, igCaption: out.instagram };
  await prisma.post.update({ where: { id: postId }, data: { ...draft, status: "draft", flags: await flagsFor(draft, store) } });
}

// ---------- 編集・承認 ----------
export async function savePost(postId: string, data: { gbpText: string; igCaption: string; imageUrl: string | null }) {
  const p = await prisma.post.findUniqueOrThrow({ where: { id: postId }, include: { store: true } });
  if (p.status === "posted") throw new Error("投稿済みのため編集できません");
  const flags = await flagsFor(data, p.store);
  // 承認済みを編集したら確認待ちに戻す
  if (p.status === "approved") await prisma.delivery.deleteMany({ where: { postId, status: "pending" } });
  await prisma.post.update({
    where: { id: postId },
    data: { ...data, flags, status: p.status === "pending" ? "pending" : "draft", approvedAt: null, approvedBy: null },
  });
  return flags;
}

// 要修正（error）がない確認待ちの投稿だけ承認する
export async function approvePosts(postIds: string[], by: string) {
  const posts = await prisma.post.findMany({ where: { id: { in: postIds }, status: "draft" }, include: { store: true } });
  let approved = 0;
  const skipped: string[] = [];
  for (const p of posts) {
    if (hasError(p.flags as Flag[]) || !p.gbpText.trim()) {
      skipped.push(p.store.name);
      continue;
    }
    const ch = storeChannels(p.store);
    const deliveries = [
      ch.gbp ? { channel: "gbp", status: "pending" } : null,
      ch.instagram
        ? p.imageUrl && p.igCaption.trim()
          ? { channel: "instagram", status: "pending" }
          : { channel: "instagram", status: "skipped", error: "画像またはキャプションがないため Instagram はスキップ" }
        : null,
    ].filter(Boolean) as { channel: string; status: string; error?: string }[];

    await prisma.$transaction([
      prisma.delivery.deleteMany({ where: { postId: p.id } }),
      prisma.delivery.createMany({ data: deliveries.map((d) => ({ ...d, postId: p.id })) }),
      prisma.post.update({ where: { id: p.id }, data: { status: "approved", approvedAt: new Date(), approvedBy: by } }),
    ]);
    approved++;
  }
  return { approved, skipped };
}

export async function unapprovePost(postId: string) {
  const sent = await prisma.delivery.count({ where: { postId, status: { in: ["sent", "sending"] } } });
  if (sent) throw new Error("すでに投稿が始まっているため取り消せません");
  await prisma.$transaction([
    prisma.delivery.deleteMany({ where: { postId } }),
    prisma.post.update({ where: { id: postId }, data: { status: "draft", approvedAt: null, approvedBy: null } }),
  ]);
}

export async function skipPost(postId: string) {
  await prisma.$transaction([
    prisma.delivery.deleteMany({ where: { postId, status: "pending" } }),
    prisma.post.update({ where: { id: postId }, data: { status: "skipped" } }),
  ]);
}

// 失敗した媒体だけ再送する
export async function retryFailed(postId: string) {
  await prisma.$transaction([
    prisma.delivery.updateMany({ where: { postId, status: "failed" }, data: { status: "pending", error: null } }),
    prisma.post.update({ where: { id: postId }, data: { status: "approved", error: null } }),
  ]);
}

// ---------- 送信（Cron から呼ぶ） ----------
export async function dispatchDue(now = new Date(), limit = 8) {
  const due = await prisma.delivery.findMany({
    where: { status: "pending", post: { status: "approved", batch: { scheduledAt: { lte: now } } } },
    include: { post: { include: { store: true } } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  for (const d of due) {
    // 二重送信防止
    const claimed = await prisma.delivery.updateMany({
      where: { id: d.id, status: "pending" },
      data: { status: "sending", attempts: { increment: 1 } },
    });
    if (!claimed.count) continue;

    const { post } = d;
    const store = post.store;
    try {
      let externalId: string;
      if (d.channel === "gbp") {
        externalId = await createLocalPost({
          accountId: store.gbpAccountId!,
          locationId: store.gbpLocationId!,
          summary: post.gbpText,
          ctaType: store.ctaType,
          ctaUrl: store.bookingUrl,
          imageUrl: post.imageUrl,
        });
      } else {
        externalId = await publishImage(store.igUserId!, decrypt(store.igAccessToken!), post.imageUrl!, post.igCaption);
      }
      await prisma.delivery.update({ where: { id: d.id }, data: { status: "sent", externalId, sentAt: new Date(), error: null } });
    } catch (e) {
      await prisma.delivery.update({
        where: { id: d.id },
        data: { status: "failed", error: e instanceof Error ? e.message : "unknown" },
      });
    }
    await settlePost(post.id);
  }
  return due.length;
}

// 媒体ごとの結果から投稿全体の状態を決める
async function settlePost(postId: string) {
  const ds = await prisma.delivery.findMany({ where: { postId } });
  if (ds.some((d) => d.status === "pending" || d.status === "sending")) return;
  const failed = ds.filter((d) => d.status === "failed");
  await prisma.post.update({
    where: { id: postId },
    data: failed.length
      ? { status: "failed", error: failed.map((d) => `${d.channel}: ${d.error}`).join("\n") }
      : { status: "posted", error: null },
  });
}

// Instagram の長期トークン（60 日）を期限 10 日前に自動延長
export async function refreshInstagramTokens(now = new Date()) {
  const soon = new Date(now.getTime() + 10 * 86400_000);
  const stores = await prisma.store.findMany({
    where: { igAccessToken: { not: null }, igTokenExpiresAt: { lte: soon } },
  });
  for (const s of stores) {
    try {
      const r = await refreshToken(decrypt(s.igAccessToken!));
      await prisma.store.update({ where: { id: s.id }, data: { igAccessToken: encrypt(r.token), igTokenExpiresAt: r.expiresAt } });
    } catch (e) {
      console.warn(`[ig] token refresh failed store=${s.name}`, e);
    }
  }
  return stores.length;
}
