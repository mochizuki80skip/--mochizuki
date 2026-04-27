"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminRole } from "@/lib/auth";

const ROLE_LABEL: Record<AdminRole, string> = {
  master: "Master",
  main: "1号店",
  branch: "2号店",
};

const ROLE_TONE: Record<AdminRole, string> = {
  master: "bg-ink-900 text-white",
  main: "bg-accent-100 text-accent-600 border border-accent",
  branch: "bg-sky-100 text-sky-700 border border-sky-300",
};

export default function AdminHeader({ role }: { role: AdminRole }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <header className="flex items-center gap-2 mb-6">
      <Link href="/admin" className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logo-mark.png" alt="" aria-hidden className="h-7 w-auto" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo-wordmark-jp.png"
          alt="リカバリー鍼灸院"
          className="h-4 w-auto"
        />
        <span className="text-[10px] tracking-[0.2em] text-accent-600 font-bold ml-1">
          ADMIN
        </span>
      </Link>
      <span
        className={[
          "ml-1 rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest",
          ROLE_TONE[role],
        ].join(" ")}
      >
        {ROLE_LABEL[role]}
      </span>
      <button
        onClick={logout}
        className="ml-auto text-[11px] tracking-widest text-ink-400 hover:text-ink-700"
      >
        ログアウト
      </button>
    </header>
  );
}
