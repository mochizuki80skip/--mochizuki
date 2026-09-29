import type { Store, PostBatch, Post } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generatePost } from "@/lib/ai";
import { checkPost, hasError, splitLines, type Flag } from "@/lib/compliance";
import { createLocalPost } from "@/lib/google";
import { startPublish, containerStatus, publishContainer, refreshToken } from "@/lib/instagram";
import { fillTemplate, type TemplateStore } from "@/lib/template";
import { generateBackground, loadImage, renderPostImage, renderReel, saveMedia } from "@/lib/media";
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

// 画像：回の共通画像 > 店舗の写真を順番に
function storePhoto(store: Store, seq: number) {
  const photos = splitLines(store.photoUrls);
  return photos.length ? photos[seq % photos.length] : null;
}
function pickImage(store: Store, batch: PostBatch, seq: number) {
  return batch.imageUrl || storePhoto(store, seq);
}

export function toTemplateStore(s: Store): TemplateStore {
  const vars = (s.vars ?? {}) as Record<string, unknown>;
  return {
    name: s.name,
    city: s.city,
    area: s.area,
    features: s.features,
    bookingUrl: s.bookingUrl,
    vars: Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, String(v ?? "")])),
  };
}

export type BatchInput = {
  theme: string;
  memo?: string;
  scheduledAt: Date;
  imageUrl?: string | null;
  mode?: "ai" | "template";
  gbpTemplate?: string;
  igTemplate?: string;
  mediaType?: "image" | "reel" | "none";
  headline?: string;
  bgPrompt?: string;
};

// ---------- 作成 ----------
export async function createBatch(input: BatchInput) {
  const stores = await prisma.store.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const targets = stores.filter((s) => {
    const ch = storeChannels(s);
    return ch.gbp || ch.instagram;
  });
  const seq = await prisma.postBatch.count();
  const batch = await prisma.postBatch.create({
    data: {
      theme: input.theme,
      memo: input.memo ?? "",
      scheduledAt: input.scheduledAt,
      imageUrl: input.imageUrl || null,
      mode: input.mode ?? "ai",
      gbpTemplate: input.gbpTemplate ?? "",
      igTemplate: input.igTemplate ?? "",
      mediaType: input.mediaType ?? "image",
      headline: input.headline ?? "",
      bgPrompt: input.bgPrompt ?? "",
    },
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
const UNFILLED = /[{｛][^{}｛｝\s]{1,20}[}｝]/g;

async function flagsFor(post: Pick<Post, "gbpText" | "igCaption">, store: Store) {
  const settings = await getSettings();
  const ch = storeChannels(store);
  const flags = checkPost(post, { ...ch, extraNgWords: splitLines(settings.extraNgWords) });
  for (const [channel, text, on] of [["gbp", post.gbpText, ch.gbp], ["instagram", post.igCaption, ch.instagram]] as const) {
    const left = on ? [...new Set(text.match(UNFILLED) ?? [])] : [];
    if (left.length) flags.push({ level: "error", channel, msg: `店舗リストに値がない差し込み項目：${left.join("、")}` });
  }
  return flags;
}

// テンプレートに店舗の値を差し込む。Instagram 用が空なら GBP 用を使い、ハッシュタグを足す
function fromTemplate(batch: PostBatch, store: Store, commonHashtags: string) {
  const ts = toTemplateStore(store);
  const gbp = fillTemplate(batch.gbpTemplate, ts).text;
  let ig = fillTemplate(batch.igTemplate || batch.gbpTemplate, ts).text;
  if (storeChannels(store).instagram && !ig.includes("#")) {
    ig = `${ig}\n\n${[commonHashtags, store.igHashtags].filter(Boolean).join(" ")}`.trim();
  }
  return { gbpText: gbp, igCaption: storeChannels(store).instagram ? ig : "" };
}

async function draftFor(batch: PostBatch, store: Store, commonHashtags: string) {
  if (batch.mode === "template") return fromTemplate(batch, store, commonHashtags);
  const out = await generatePost({
    store: { name: store.name, area: [store.city, store.area].filter(Boolean).join(" "), features: store.features, hashtags: store.igHashtags },
    theme: batch.theme,
    memo: batch.memo,
    scheduledAt: batch.scheduledAt,
    commonHashtags,
    withInstagram: storeChannels(store).instagram,
  });
  return { gbpText: out.gbp, igCaption: out.instagram };
}

// 未生成の投稿を最大 limit 件生成する（Vercel の実行時間制限があるため小分けに呼ぶ）
export async function generatePending(batchId: string, limit = 6) {
  const settings = await getSettings();
  const batch = await prisma.postBatch.findUniqueOrThrow({ where: { id: batchId } });
  const pending = await prisma.post.findMany({
    where: { batchId, status: "pending" },
    include: { store: true },
    // テンプレートは AI を使わないので一度に全店舗処理できる
    take: batch.mode === "template" ? undefined : limit,
  });

  await Promise.all(
    pending.map(async (p) => {
      try {
        const draft = await draftFor(batch, p.store, settings.commonHashtags);
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
  const draft = await draftFor(batch, store, settings.commonHashtags);
  await prisma.post.update({ where: { id: postId }, data: { ...draft, status: "draft", error: null, flags: await flagsFor(draft, store) } });
}

// 作成方法やテンプレートを変えたときに、未承認の投稿を作り直し対象に戻す
export async function resetDrafts(batchId: string) {
  const r = await prisma.post.updateMany({ where: { batchId, status: { in: ["draft", "pending"] } }, data: { status: "pending", error: null } });
  return r.count;
}

// ---------- 画像・動画 ----------
export async function makeBackground(batchId: string) {
  const b = await prisma.postBatch.findUniqueOrThrow({ where: { id: batchId } });
  const prompt = b.bgPrompt || `接骨院の SNS 投稿用の背景写真。テーマ「${b.theme}」をイメージした落ち着いた雰囲気の写真。`;
  const url = await generateBackground(prompt, b.mediaType === "reel" ? "9:16" : "4:5");
  await prisma.postBatch.update({ where: { id: batchId }, data: { bgImageUrl: url } });
  return url;
}

// 本文の見出し（【】）を除いた最初の 1〜2 文をリールの 2 枚目に使う
function keyPoint(text: string) {
  const body = text.replace(/^【[^】]*】\s*/, "").replace(/\s+/g, " ").trim();
  const sentences = body.match(/[^。！？!?]+[。！？!?]?/g) ?? [body];
  let out = "";
  for (const s of sentences) {
    if ((out + s).length > 70) break;
    out += s;
  }
  return out || body.slice(0, 70);
}

// 指定した投稿の画像（リールなら動画も）を作る。1 回の呼び出しで数店舗ずつ処理する
export async function makeMedia(batchId: string, postIds: string[]) {
  const settings = await getSettings();
  const batch = await prisma.postBatch.findUniqueOrThrow({ where: { id: batchId } });
  const posts = await prisma.post.findMany({
    where: { id: { in: postIds }, batchId, status: { in: ["pending", "draft"] } },
    include: { store: true },
  });
  const seq = await prisma.postBatch.count({ where: { createdAt: { lt: batch.createdAt } } });
  const errors: string[] = [];
  for (const p of posts) {
    try {
      const bgUrl = batch.bgImageUrl || batch.imageUrl || storePhoto(p.store, seq);
      const bg = bgUrl ? await loadImage(bgUrl) : null;
      const common = {
        bg,
        headline: batch.headline || batch.theme,
        storeName: p.store.name,
        storeArea: p.store.area || p.store.city,
        color: settings.brandColor,
      };
      if (batch.mediaType === "reel") {
        const r = await renderReel({ ...common, point: keyPoint(p.gbpText || batch.theme) });
        const [videoUrl, imageUrl] = await Promise.all([saveMedia(r.video, "mp4"), saveMedia(r.cover, "jpg")]);
        await prisma.post.update({ where: { id: p.id }, data: { videoUrl, imageUrl } });
      } else {
        const img = await renderPostImage(common);
        await prisma.post.update({ where: { id: p.id }, data: { imageUrl: await saveMedia(img, "jpg"), videoUrl: null } });
      }
    } catch (e) {
      errors.push(`${p.store.name}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }
  return { processed: posts.length, errors };
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
  const posts = await prisma.post.findMany({ where: { id: { in: postIds }, status: "draft" }, include: { store: true, batch: true } });
  let approved = 0;
  const skipped: string[] = [];
  for (const p of posts) {
    const reason = hasError(p.flags as Flag[])
      ? "要修正あり"
      : !p.gbpText.trim()
        ? "本文なし"
        : p.batch.mediaType === "reel" && storeChannels(p.store).instagram && !p.videoUrl
          ? "リール動画が未作成"
          : null;
    if (reason) {
      skipped.push(`${p.store.name}（${reason}）`);
      continue;
    }
    const ch = storeChannels(p.store);
    const deliveries = [
      ch.gbp ? { channel: "gbp", status: "pending" } : null,
      ch.instagram
        ? (p.imageUrl || p.videoUrl) && p.igCaption.trim()
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
  const sent = await prisma.delivery.count({ where: { postId, status: { in: ["sent", "sending", "processing"] } } });
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
        const r = await startPublish(store.igUserId!, decrypt(store.igAccessToken!), {
          imageUrl: post.imageUrl,
          videoUrl: post.videoUrl,
          caption: post.igCaption,
        });
        if (r.state === "processing") {
          // リールは Instagram 側の動画処理を待ち、次回以降の Cron で公開する
          await prisma.delivery.update({ where: { id: d.id }, data: { status: "processing", externalId: r.containerId } });
          continue;
        }
        externalId = r.mediaId;
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
  await publishProcessedReels();
  return due.length;
}

// 処理が終わったリールを公開する（30 分たっても終わらなければ失敗扱い）
async function publishProcessedReels() {
  const waiting = await prisma.delivery.findMany({
    where: { status: "processing" },
    include: { post: { include: { store: true } } },
    take: 10,
  });
  for (const d of waiting) {
    const store = d.post.store;
    try {
      const token = decrypt(store.igAccessToken!);
      const s = await containerStatus(d.externalId!, token);
      if (s.code === "IN_PROGRESS") {
        if (Date.now() - d.updatedAt.getTime() > 30 * 60_000) throw new Error("Instagram の動画処理が 30 分以内に終わりませんでした");
        continue;
      }
      if (s.code !== "FINISHED") throw new Error(`Instagram の動画処理に失敗（${s.code} ${s.detail}）`);
      const mediaId = await publishContainer(store.igUserId!, token, d.externalId!);
      await prisma.delivery.update({ where: { id: d.id }, data: { status: "sent", externalId: mediaId, sentAt: new Date(), error: null } });
    } catch (e) {
      await prisma.delivery.update({ where: { id: d.id }, data: { status: "failed", error: e instanceof Error ? e.message : "unknown" } });
    }
    await settlePost(d.postId);
  }
}

// 媒体ごとの結果から投稿全体の状態を決める
async function settlePost(postId: string) {
  const ds = await prisma.delivery.findMany({ where: { postId } });
  if (ds.some((d) => ["pending", "sending", "processing"].includes(d.status))) return;
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
