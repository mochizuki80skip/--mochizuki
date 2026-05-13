"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error: authError } = await fn;
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    if (mode === "signup") {
      setError(
        "確認メールを送信しました。メール内のリンクをクリックしてください。"
      );
      return;
    }
    router.replace("/customers");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg p-6 shadow-sm border border-brand-100">
      <h1 className="text-lg font-semibold mb-4">
        {mode === "signin" ? "ログイン" : "新規スタッフ登録"}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">メール</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">パスワード</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2 rounded disabled:opacity-60"
        >
          {loading ? "処理中…" : mode === "signin" ? "ログイン" : "登録"}
        </button>
      </form>
      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="mt-4 text-sm text-brand-600 hover:underline"
      >
        {mode === "signin"
          ? "新しいスタッフを登録"
          : "ログイン画面に戻る"}
      </button>
    </div>
  );
}
