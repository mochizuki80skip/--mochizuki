import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReplyCreator, type Customer, type PromiseRow } from "./reply-creator";

export const dynamic = "force-dynamic";

export default async function ReplyPage({
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

  const { data: promises } = await supabase
    .from("promises")
    .select("id, title, unit, target, is_active")
    .eq("customer_id", id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-4">
      <div>
        <Link
          href={`/customers/${customer.id}`}
          className="text-sm text-brand-600 hover:underline"
        >
          ← {customer.name} さんの詳細に戻る
        </Link>
      </div>

      <ReplyCreator
        customer={customer as Customer}
        promises={(promises ?? []) as PromiseRow[]}
      />
    </div>
  );
}
