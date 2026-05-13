import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!customer) notFound();

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
      <ImportForm customerId={customer.id} customerName={customer.name} />
    </div>
  );
}
