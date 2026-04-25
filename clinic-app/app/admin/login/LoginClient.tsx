"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("合言葉が違います");
        return;
      }
      const next = params.get("next") || "/admin";
      router.replace(next);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-12 fade-up">
      <header className="flex items-center gap-2 mb-10">
        <Link href="/" className="text-ink-500 text-sm tracking-widest">
          ← TOP
        </Link>
        <span className="ml-auto text-[10px] tracking-[0.2em] text-ink-400">
          ADMIN
        </span>
      </header>

      <h1 className="text-[22px] font-black text-ink-900 mb-2">
        リカバリー鍼灸院
        <span className="block text-sm text-ink-500 font-bold mt-1">
          スタッフ管理画面
        </span>
      </h1>
      <p className="text-sm text-ink-500 mb-8">
        合言葉を入力して管理画面に進みます。
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="password"
            className="block text-xs tracking-widest text-ink-400 mb-1.5"
          >
            合言葉
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className="block w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 text-rose-700 text-sm px-3 py-2 border border-rose-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !password}
          className="block w-full text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition disabled:bg-ink-100 disabled:text-ink-300"
        >
          {submitting ? "確認中..." : "ログイン"}
        </button>
      </form>
    </main>
  );
}
