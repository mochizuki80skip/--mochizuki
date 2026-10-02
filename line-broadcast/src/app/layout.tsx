import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "接骨院 LINE 一括配信",
  description: "接骨院の公式LINE複数アカウントを一括で配信・管理するシステム",
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
