import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "LINE Platform",
  description: "公式LINE運用プラットフォーム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="antialiased text-gray-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
