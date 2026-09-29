import { prisma } from "@/lib/prisma";
import { customKeys } from "@/lib/stores";
import { StoreGrid } from "./StoreGrid";

export const dynamic = "force-dynamic";

export default async function StoreListPage() {
  const stores = await prisma.store.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }] });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">店舗リスト（差し込み項目）</h1>
      <p className="text-sm text-gray-500">
        テンプレートの {"{院名}"} {"{地名}"} {"{エリア}"} などに入る値です。列を追加すると {"{列名}"} で使えます（例：「駐車場」列 → {"{駐車場}"}）。
        Excel で編集したい場合は CSV を書き出して、編集後に取り込んでください（ID 列は変更しないでください）。
      </p>
      <StoreGrid
        initial={stores.map((s) => ({
          id: s.id,
          isActive: s.isActive,
          fields: { name: s.name, city: s.city, area: s.area, features: s.features, bookingUrl: s.bookingUrl, igHashtags: s.igHashtags },
          vars: Object.fromEntries(Object.entries((s.vars ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")])),
        }))}
        initialKeys={customKeys(stores)}
      />
    </div>
  );
}
