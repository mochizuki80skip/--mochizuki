import { prisma } from "@/lib/prisma";
import { toTemplateStore } from "@/lib/posts";
import { customKeys } from "@/lib/stores";

// テンプレート編集画面のプレビュー用の店舗データ
export async function previewStores() {
  const stores = await prisma.store.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return { stores: stores.map((s) => ({ id: s.id, ...toTemplateStore(s) })), customKeys: customKeys(stores) };
}
