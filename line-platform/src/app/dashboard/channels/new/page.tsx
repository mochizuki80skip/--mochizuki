import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { ChannelNewForm } from "./ChannelNewForm";

export const dynamic = "force-dynamic";

export default async function NewChannelPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "super_admin") redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link href="/dashboard/channels" className="text-sm text-gray-600 hover:text-gray-900">
            ← LINE アカウント管理に戻る
          </Link>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">LINE アカウントを追加</h1>
        <ChannelNewForm />
      </main>
    </div>
  );
}
