"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { encrypt } from "@/lib/crypto";
import { listAllLocations } from "@/lib/google";
import {
  approvePosts,
  createBatch,
  createNextWeek,
  generatePending,
  regenerate,
  retryFailed,
  savePost,
  skipPost,
  unapprovePost,
} from "@/lib/posts";

export async function signOutAction() {
  redirect("/api/auth/signout?callbackUrl=/login");
}

// ---------- 投稿 ----------
export async function createNextWeekAction() {
  await requireUser();
  const created = await createNextWeek();
  revalidatePath("/dashboard");
  return created.length;
}

export async function createBatchAction(form: FormData) {
  await requireUser();
  const date = String(form.get("date"));
  const time = String(form.get("time") || "10:00");
  const b = await createBatch({
    theme: String(form.get("theme")),
    memo: String(form.get("memo") ?? ""),
    imageUrl: String(form.get("imageUrl") ?? "").trim() || null,
    scheduledAt: new Date(`${date}T${time}:00+09:00`),
  });
  redirect(`/dashboard/batches/${b.id}`);
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
  const started = await prisma.delivery.count({ where: { post: { batchId }, status: { in: ["sent", "sending"] } } });
  if (started) throw new Error("投稿済みの店舗があるため削除できません");
  await prisma.postBatch.delete({ where: { id: batchId } });
  redirect("/dashboard");
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
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const token = s("igAccessToken");
  const days = Number(s("igTokenDays") || 60);
  await prisma.store.update({
    where: { id: storeId },
    data: {
      name: s("name"),
      area: s("area"),
      features: s("features"),
      bookingUrl: s("bookingUrl"),
      ctaType: s("ctaType") || "BOOK",
      photoUrls: s("photoUrls"),
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

// ---------- 設定 ----------
export async function updateSettingsAction(form: FormData) {
  await requireUser();
  await prisma.settings.update({
    where: { id: "default" },
    data: {
      postingDays: form.getAll("postingDays").map(Number),
      postingTime: String(form.get("postingTime") || "10:00"),
      commonHashtags: String(form.get("commonHashtags") ?? ""),
      extraNgWords: String(form.get("extraNgWords") ?? ""),
    },
  });
  revalidatePath("/dashboard/settings");
}

export async function disconnectGoogleAction() {
  await requireUser();
  await prisma.googleConnection.deleteMany();
  revalidatePath("/dashboard/settings");
}
