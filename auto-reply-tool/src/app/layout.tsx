import "./globals.css";
import type { Metadata } from "next";
import { AppSidebar } from "./app-sidebar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "ONE'S BODY 返信アシスタント",
  description: "kaloko お約束機能の返信を支援するツール",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let trainerDisplayName: string | null = null;
  if (user) {
    const { data: trainer } = await supabase
      .from("trainers")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    trainerDisplayName = trainer?.display_name ?? null;
  }

  return (
    <html lang="ja">
      <body className="min-h-screen bg-brand-50 text-gray-900">
        {user ? (
          <div className="flex">
            <AppSidebar
              userEmail={user.email ?? ""}
              trainerDisplayName={trainerDisplayName}
            />
            <main className="flex-1 min-w-0 px-6 py-6">
              <div className="max-w-5xl mx-auto">{children}</div>
            </main>
          </div>
        ) : (
          <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
        )}
      </body>
    </html>
  );
}
