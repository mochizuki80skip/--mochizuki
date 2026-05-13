import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  name: string;
  goal: string | null;
  tone_memo: string | null;
  updated_at: string;
};

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, name, goal, tone_memo, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">お客様一覧</h1>
        <Link
          href="/customers/new"
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm px-3 py-2 rounded"
        >
          + 新規追加
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-600">読み込みエラー: {error.message}</p>
      )}

      {!error && (data ?? []).length === 0 && (
        <div className="bg-white rounded-lg p-6 border border-brand-100 text-gray-600">
          まだお客様が登録されていません。「+ 新規追加」から登録してください。
        </div>
      )}

      <ul className="space-y-2">
        {(data ?? []).map((c: Customer) => (
          <li
            key={c.id}
            className="bg-white rounded-lg border border-brand-100 hover:border-brand-500 transition"
          >
            <Link href={`/customers/${c.id}`} className="block p-4">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{c.name}</span>
                <span className="text-xs text-gray-500">
                  {new Date(c.updated_at).toLocaleDateString("ja-JP")}
                </span>
              </div>
              {c.goal && (
                <div className="text-sm text-gray-600 mt-1">目標: {c.goal}</div>
              )}
              {c.tone_memo && (
                <div className="text-xs text-gray-500 mt-1">
                  距離感: {c.tone_memo}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
