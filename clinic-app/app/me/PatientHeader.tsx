"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PatientHeader() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/me/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <header className="flex items-center gap-2 mb-6">
      <Link href="/me/dashboard" className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logo-mark.png" alt="" aria-hidden className="h-7 w-auto" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo-wordmark-jp.png"
          alt="リカバリー鍼灸院"
          className="h-4 w-auto"
        />
        <span className="text-[10px] tracking-[0.18em] text-ink-400 ml-1">
          / マイページ
        </span>
      </Link>
      <button
        onClick={logout}
        className="ml-auto text-[11px] tracking-widest text-ink-400 hover:text-ink-700"
      >
        ログアウト
      </button>
    </header>
  );
}
