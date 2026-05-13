import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CustomerListClient } from "./customer-list-client";

export const dynamic = "force-dynamic";

export type CustomerListItem = {
  id: string;
  name: string;
  goal: string | null;
  tone_memo: string | null;
  updated_at: string;
  last_report_date: string | null;
  report_count: number;
};

export default async function CustomersPage() {
  const supabase = await createClient();

  const [{ data: customers, error }, { data: reports }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, goal, tone_memo, updated_at")
      .order("updated_at", { ascending: false }),
    supabase.from("reports").select("customer_id, report_date"),
  ]);

  const stats = new Map<
    string,
    { count: number; lastDate: string | null }
  >();
  for (const r of reports ?? []) {
    const cur = stats.get(r.customer_id) ?? { count: 0, lastDate: null };
    cur.count += 1;
    if (!cur.lastDate || r.report_date > cur.lastDate) {
      cur.lastDate = r.report_date;
    }
    stats.set(r.customer_id, cur);
  }

  const enriched: CustomerListItem[] = (customers ?? []).map((c) => {
    const s = stats.get(c.id);
    return {
      ...c,
      last_report_date: s?.lastDate ?? null,
      report_count: s?.count ?? 0,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">お客様一覧</h1>
          <p className="text-sm text-gray-600 mt-1">
            登録 {enriched.length} 名 · 返信履歴{" "}
            {Array.from(stats.values()).reduce((a, s) => a + s.count, 0)} 件
          </p>
        </div>
        <Link
          href="/customers/new"
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded shadow-sm"
        >
          + 新規追加
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-600">読み込みエラー: {error.message}</p>
      )}

      <CustomerListClient items={enriched} />
    </div>
  );
}
