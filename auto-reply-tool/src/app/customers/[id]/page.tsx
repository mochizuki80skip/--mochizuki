import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CustomerEditor } from "./customer-editor";
import { PromiseManager, type PromiseRow } from "./promise-manager";
import { HistoryList } from "./history-list";

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
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/customers"
          className="text-sm text-brand-600 hover:underline"
        >
          ← お客様一覧
        </Link>
        <Link
          href={`/customers/${customer.id}/reply`}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded shadow-sm"
        >
          🪄 返信を作る
        </Link>
      </div>

      <CustomerEditor customer={customer} />
      <PromiseManager
        customerId={customer.id}
        initial={(promisesData ?? []) as PromiseRow[]}
      />

      <HistoryList customerId={customer.id} />
    </div>
  );
}
