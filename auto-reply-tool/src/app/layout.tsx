import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
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

  return (
    <html lang="ja">
      <body className="min-h-screen">
        <header className="bg-white border-b border-brand-100">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
            <Link href="/" className="font-semibold text-brand-700">
              ONE&apos;S BODY 返信アシスタント
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {user ? (
                <>
                  <Link href="/customers" className="hover:underline">
                    お客様一覧
                  </Link>
                  <span className="text-gray-500">{user.email}</span>
                  <form action="/auth/signout" method="post">
                    <button
                      type="submit"
                      className="text-gray-600 hover:text-brand-600"
                    >
                      ログアウト
                    </button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="text-brand-600 hover:underline">
                  ログイン
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
