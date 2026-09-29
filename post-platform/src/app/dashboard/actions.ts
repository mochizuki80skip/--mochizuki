"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { decrypt, encrypt } from "@/lib/crypto";
import { listAllLocations } from "@/lib/google";
import { saveMedia } from "@/lib/media";
import { decodeCsv, parseCsv } from "@/lib/csv";
import { STORE_COLUMNS, type EditableField } from "@/lib/stores";
import { runReport, startReport } from "@/lib/analysis";
import {
  approvePosts,
  createBatch,
  createNextWeek,
  generatePending,
  makeBackground,
  makeMedia,
  regenerate,
  resetDrafts,
  retryFailed,
  savePost,
  skipPost,
  unapprovePost,
} from "@/lib/posts";

export async function signOutAction() {
  redirect("/api/auth/signout?callbackUrl=/login");
}

const str = (form: FormData, k: string) => String(form.get(k) ?? "").trim();

// ---------- 投稿 ----------
export async function createNextWeekAction() {
  await requireUser();
  const created = await createNextWeek();
  revalidatePath("/dashboard");
  return created.length;
}

function batchFields(form: FormData) {
  return {
    theme: str(form, "theme"),
    memo: str(form, "memo"),
    mode: (str(form, "mode") === "template" ? "template" : "ai") as "ai" | "template",
    gbpTemplate: String(form.get("gbpTemplate") ?? ""),
    igTemplate: String(form.get("igTemplate") ?? ""),
    mediaType: (["image", "reel", "none"].includes(str(form, "mediaType")) ? str(form, "mediaType") : "image") as "image" | "reel" | "none",
    headline: str(form, "headline"),
    bgPrompt: str(form, "bgPrompt"),
  };
}

export async function createBatchAction(form: FormData) {
  await requireUser();
  const f = batchFields(form);
  if (f.mode === "template" && !f.gbpTemplate.trim()) throw new Error("テンプレートを入力してください");
  const b = await createBatch({
    ...f,
    imageUrl: str(form, "imageUrl") || null,
    scheduledAt: new Date(`${str(form, "date")}T${str(form, "time") || "10:00"}:00+09:00`),
  });
  redirect(`/dashboard/batches/${b.id}`);
}

// 回の作成方法・テンプレート・画像設定を変更し、未承認の投稿を作り直し対象に戻す
export async function updateBatchAction(batchId: string, form: FormData) {
  await requireUser();
  const f = batchFields(form);
  await prisma.postBatch.update({ where: { id: batchId }, data: f });
  const reset = await resetDrafts(batchId);
  revalidatePath(`/dashboard/batches/${batchId}`);
  return reset;
}

export async function generateAction(batchId: string) {
  await requireUser();
  const r = await generatePending(batchId);
  revalidatePath(`/dashboard/batches/${batchId}`);
  return r;
}

export async function regenerateAction(postId: string) {
  await requireUser();
  await regenerate(postId);
  revalidatePath("/dashboard/batches");
}

export async function savePostAction(postId: string, data: { gbpText: string; igCaption: string; imageUrl: string | null }) {
  await requireUser();
  const flags = await savePost(postId, data);
  revalidatePath("/dashboard/batches");
  return flags;
}

export async function approveAction(postIds: string[]) {
  const user = await requireUser();
  const r = await approvePosts(postIds, user.email);
  revalidatePath("/dashboard");
  return r;
}

export async function unapproveAction(postId: string) {
  await requireUser();
  await unapprovePost(postId);
  revalidatePath("/dashboard");
}

export async function skipAction(postId: string) {
  await requireUser();
  await skipPost(postId);
  revalidatePath("/dashboard");
}

export async function retryAction(postId: string) {
  await requireUser();
  await retryFailed(postId);
  revalidatePath("/dashboard");
}

export async function deleteBatchAction(batchId: string) {
  await requireUser();
  const started = await prisma.delivery.count({ where: { post: { batchId }, status: { in: ["sent", "sending", "processing"] } } });
  if (started) throw new Error("投稿済みの店舗があるため削除できません");
  await prisma.postBatch.delete({ where: { id: batchId } });
  redirect("/dashboard");
}

// ---------- 画像・動画 ----------
export async function makeBackgroundAction(batchId: string) {
  await requireUser();
  const url = await makeBackground(batchId);
  revalidatePath(`/dashboard/batches/${batchId}`);
  return url;
}

export async function uploadBackgroundAction(batchId: string, form: FormData) {
  await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("画像を選んでください");
  const url = await saveUpload(file);
  await prisma.postBatch.update({ where: { id: batchId }, data: { bgImageUrl: url } });
  revalidatePath(`/dashboard/batches/${batchId}`);
}

export async function clearBackgroundAction(batchId: string) {
  await requireUser();
  await prisma.postBatch.update({ where: { id: batchId }, data: { bgImageUrl: null } });
  revalidatePath(`/dashboard/batches/${batchId}`);
}

export async function makeMediaAction(batchId: string, postIds: string[]) {
  await requireUser();
  const r = await makeMedia(batchId, postIds);
  revalidatePath(`/dashboard/batches/${batchId}`);
  return r;
}

async function saveUpload(file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? "png" : "jpg";
  if (!["image/png", "image/jpeg"].includes(file.type)) throw new Error("JPEG または PNG の画像を選んでください");
  return saveMedia(buf, ext);
}

// ---------- 店舗 ----------
export async function listGoogleLocationsAction() {
  await requireUser();
  return listAllLocations();
}

export async function importStoresAction(
  locations: { accountId: string; locationId: string; title: string; websiteUri: string }[],
) {
  await requireUser();
  for (const l of locations) {
    await prisma.store.upsert({
      where: { gbpLocationId: l.locationId },
      create: { name: l.title, gbpAccountId: l.accountId, gbpLocationId: l.locationId, bookingUrl: l.websiteUri },
      update: { gbpAccountId: l.accountId, isActive: true },
    });
  }
  revalidatePath("/dashboard/stores");
}

export async function updateStoreAction(storeId: string, form: FormData) {
  await requireUser();
  const s = (k: string) => str(form, k);
  const token = s("igAccessToken");
  const days = Number(s("igTokenDays") || 60);
  // 任意項目：varKey[] / varValue[] の組
  const keys = form.getAll("varKey").map(String);
  const values = form.getAll("varValue").map(String);
  const vars = Object.fromEntries(keys.map((k, i) => [k.trim(), (values[i] ?? "").trim()]).filter(([k]) => k));
  // 写真のアップロード
  const uploaded: string[] = [];
  for (const f of form.getAll("photoFiles")) {
    if (f instanceof File && f.size) uploaded.push(await saveUpload(f));
  }
  await prisma.store.update({
    where: { id: storeId },
    data: {
      name: s("name"),
      city: s("city"),
      area: s("area"),
      features: s("features"),
      vars,
      bookingUrl: s("bookingUrl"),
      ctaType: s("ctaType") || "BOOK",
      photoUrls: [s("photoUrls"), ...uploaded].filter(Boolean).join("\n"),
      igHashtags: s("igHashtags"),
      igUserId: s("igUserId") || null,
      gbpEnabled: form.get("gbpEnabled") === "on",
      igEnabled: form.get("igEnabled") === "on",
      isActive: form.get("isActive") === "on",
      sortOrder: Number(s("sortOrder") || 0),
      // トークンは入力されたときだけ更新（空欄なら現状維持）
      ...(token ? { igAccessToken: encrypt(token), igTokenExpiresAt: new Date(Date.now() + days * 86400_000) } : {}),
    },
  });
  redirect("/dashboard/stores");
}

type BulkRow = { id: string; fields: Record<EditableField, string>; vars: Record<string, string> };

export async function bulkUpdateStoresAction(rows: BulkRow[]) {
  await requireUser();
  await prisma.$transaction(
    rows.map((r) =>
      prisma.store.update({
        where: { id: r.id },
        data: { ...r.fields, name: r.fields.name.trim() || undefined, vars: r.vars as Prisma.InputJsonValue },
      }),
    ),
  );
  revalidatePath("/dashboard/stores");
  return rows.length;
}

// CSV 取り込み：ID（なければ院名）で店舗を特定し、標準列以外は任意項目として保存
export async function importCsvAction(form: FormData) {
  await requireUser();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) throw new Error("CSV ファイルを選んでください");
  const [header, ...body] = parseCsv(decodeCsv(await file.arrayBuffer()));
  if (!header) throw new Error("CSV が空です");
  const col = (label: string) => header.findIndex((h) => h.trim() === label);
  const std = STORE_COLUMNS.map((c) => ({ ...c, idx: col(c.label) }));
  const idIdx = std.find((c) => c.field === "id")!.idx;
  const nameIdx = std.find((c) => c.field === "name")!.idx;
  const customIdx = header.map((h, i) => [h.trim(), i] as const).filter(([h, i]) => h && !std.some((c) => c.idx === i));

  const stores = await prisma.store.findMany();
  let updated = 0;
  const notFound: string[] = [];
  for (const row of body) {
    const id = idIdx >= 0 ? row[idIdx]?.trim() : "";
    const store = stores.find((s) => (id ? s.id === id : nameIdx >= 0 && s.name === row[nameIdx]?.trim()));
    if (!store) {
      notFound.push(row[nameIdx] ?? id ?? "?");
      continue;
    }
    const data: Record<string, string> = {};
    for (const c of std) if (c.field !== "id" && c.idx >= 0 && row[c.idx] !== undefined) data[c.field] = row[c.idx].trim();
    if (data.name === "") delete data.name;
    const vars = { ...((store.vars ?? {}) as Record<string, string>) };
    for (const [key, i] of customIdx) vars[key] = (row[i] ?? "").trim();
    await prisma.store.update({ where: { id: store.id }, data: { ...data, vars } });
    updated++;
  }
  revalidatePath("/dashboard/stores");
  return { updated, notFound };
}

// ---------- ログイン情報 ----------
export async function saveCredentialAction(form: FormData) {
  const user = await requireUser();
  const storeId = str(form, "storeId");
  const service = str(form, "service") || "instagram";
  const loginId = str(form, "loginId");
  const password = String(form.get("password") ?? "");
  if (!loginId) throw new Error("ログイン ID を入力してください");
  const cred = await prisma.storeCredential.upsert({
    where: { storeId_service: { storeId, service } },
    create: { storeId, service, loginId, passwordEnc: password ? encrypt(password) : "", note: str(form, "note"), updatedBy: user.email },
    update: { loginId, note: str(form, "note"), updatedBy: user.email, ...(password ? { passwordEnc: encrypt(password) } : {}) },
  });
  await prisma.credentialAccessLog.create({ data: { credentialId: cred.id, userEmail: user.email, action: "update" } });
  revalidatePath("/dashboard/credentials");
}

// 表示するには本部ログインのパスワードを再入力する。表示した記録を残す
export async function revealCredentialAction(credentialId: string, adminPassword: string) {
  const user = await requireUser();
  const admin = await prisma.adminUser.findUnique({ where: { email: user.email } });
  if (!admin || !(await bcrypt.compare(adminPassword, admin.passwordHash))) throw new Error("パスワードが違います");
  const cred = await prisma.storeCredential.findUniqueOrThrow({ where: { id: credentialId } });
  await prisma.credentialAccessLog.create({ data: { credentialId, userEmail: user.email, action: "reveal" } });
  revalidatePath("/dashboard/credentials");
  return { loginId: cred.loginId, password: cred.passwordEnc ? decrypt(cred.passwordEnc) : "" };
}

export async function deleteCredentialAction(credentialId: string) {
  await requireUser();
  await prisma.storeCredential.delete({ where: { id: credentialId } });
  revalidatePath("/dashboard/credentials");
}

// ---------- 分析 ----------
export async function startReportAction() {
  const user = await requireUser();
  const { report, created } = await startReport(user.email);
  // 数分かかるため、画面にはすぐ戻してバックグラウンドで集計する
  if (created) after(() => runReport(report.id));
  revalidatePath("/dashboard/analysis");
}

// ---------- 設定 ----------
export async function updateSettingsAction(form: FormData) {
  await requireUser();
  await prisma.settings.update({
    where: { id: "default" },
    data: {
      postingDays: form.getAll("postingDays").map(Number),
      postingTime: str(form, "postingTime") || "10:00",
      commonHashtags: str(form, "commonHashtags"),
      extraNgWords: String(form.get("extraNgWords") ?? ""),
      brandColor: /^#[0-9a-fA-F]{6}$/.test(str(form, "brandColor")) ? str(form, "brandColor") : "#1a73e8",
    },
  });
  revalidatePath("/dashboard/settings");
}

export async function disconnectGoogleAction() {
  await requireUser();
  await prisma.googleConnection.deleteMany();
  revalidatePath("/dashboard/settings");
}
