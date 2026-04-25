"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminHeader() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <header className="flex items-center gap-2 mb-6">
      <Link
        href="/admin"
        className="text-sm font-bold tracking-[0.18em] text-ink-700"
      >
        KARADA <span className="text-accent-600">ADMIN</span>
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
