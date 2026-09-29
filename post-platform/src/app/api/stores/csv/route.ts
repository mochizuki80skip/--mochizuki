import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { toCsv } from "@/lib/csv";
import { STORE_COLUMNS, customKeys } from "@/lib/stores";

// 店舗リストの CSV 出力（Excel で編集して取り込み直せる）
export async function GET() {
  await requireUser();
  const stores = await prisma.store.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const custom = customKeys(stores);
  const rows = [
    [...STORE_COLUMNS.map((c) => c.label), ...custom],
    ...stores.map((s) => {
      const vars = (s.vars ?? {}) as Record<string, string>;
      return [...STORE_COLUMNS.map((c) => String(s[c.field] ?? "")), ...custom.map((k) => vars[k] ?? "")];
    }),
  ];
  return new Response(toCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent("店舗リスト.csv")}`,
    },
  });
}
