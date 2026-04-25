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
      <Link href="/admin" className="flex items-baseline gap-2">
        <span className="text-sm font-black tracking-[0.12em] text-ink-900">
          リカバリー鍼灸院
        </span>
        <span className="text-[10px] tracking-[0.2em] text-accent-600 font-bold">
          ADMIN
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
