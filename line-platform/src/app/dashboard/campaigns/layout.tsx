import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/permissions";

export default async function CampaignsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
            <ArrowLeft size={14} /> LINE アカウント一覧
          </Link>
          <Link href="/dashboard/campaigns" className="font-bold text-line">
            全店舗 一括配信
          </Link>
          <span className="text-xs text-gray-500">{user.email}</span>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
