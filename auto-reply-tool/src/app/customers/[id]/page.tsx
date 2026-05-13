import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerEditor } from "./customer-editor";
import { PromiseManager, type PromiseRow } from "./promise-manager";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, goal, tone_memo")
    .eq("id", id)
    .single();

  if (!customer) notFound();

  const { data: promisesData } = await supabase
    .from("promises")
    .select("id, title, unit, target, is_active")
    .eq("customer_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/customers"
          className="text-sm text-brand-600 hover:underline"
        >
          ← お客様一覧
        </Link>
      </div>

      <CustomerEditor customer={customer} />
      <PromiseManager
        customerId={customer.id}
        initial={(promisesData ?? []) as PromiseRow[]}
      />

      <div className="bg-white rounded-lg p-5 border border-brand-100 opacity-60">
        <h2 className="font-semibold mb-1">過去のやり取り (Week 2 で実装)</h2>
        <p className="text-sm text-gray-600">
          ここに採用された返信履歴が新しい順に並びます。
        </p>
      </div>
    </div>
  );
}
