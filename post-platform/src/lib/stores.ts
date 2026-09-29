import type { Store } from "@prisma/client";

// 店舗リスト（一覧編集・CSV）の標準列
export const STORE_COLUMNS = [
  { field: "id", label: "ID（変更しない）" },
  { field: "name", label: "院名" },
  { field: "city", label: "地名" },
  { field: "area", label: "エリア" },
  { field: "features", label: "特徴" },
  { field: "bookingUrl", label: "予約URL" },
  { field: "igHashtags", label: "ハッシュタグ" },
] as const satisfies readonly { field: keyof Store; label: string }[];

export type EditableField = Exclude<(typeof STORE_COLUMNS)[number]["field"], "id">;

// 全店舗の任意項目（差し込み用）の列名
export function customKeys(stores: Pick<Store, "vars">[]) {
  const keys = new Set<string>();
  for (const s of stores) Object.keys((s.vars ?? {}) as object).forEach((k) => keys.add(k));
  return [...keys];
}
