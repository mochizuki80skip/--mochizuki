import type { Metadata } from "next";
import Script from "next/script";
import "./liff.css";

export const metadata: Metadata = {
  title: "予約",
  viewport: { width: "device-width", initialScale: 1, viewportFit: "cover" },
};

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://static.line-scdn.net/liff/edge/2/sdk.js" strategy="beforeInteractive" />
      <div className="liff-root">{children}</div>
    </>
  );
}
