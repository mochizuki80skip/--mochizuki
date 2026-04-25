"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function VerifyForm({
  initialChartNumber = "",
  initialName = "",
  autoSubmit = false,
}: {
  initialChartNumber?: string;
  initialName?: string;
  autoSubmit?: boolean;
}) {
  const router = useRouter();
  const [chartNumber, setChartNumber] = useState(initialChartNumber);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const autoTried = useRef(false);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/me/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chart_number: chartNumber, name }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === "not_found") {
          setError("カルテ番号と氏名が一致しません。番号と漢字を確認してください。");
        } else if (json?.error === "missing_fields") {
          setError("カルテ番号と氏名を入力してください");
        } else {
          setError("確認できませんでした");
        }
        return;
      }
      router.replace("/me/dashboard");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  // QR auto-fill flow: when both fields are pre-filled from the URL, try once
  // automatically. The user only sees the form if it fails (e.g. typo in URL).
  useEffect(() => {
    if (!autoSubmit) return;
    if (autoTried.current) return;
    if (!initialChartNumber || !initialName) return;
    autoTried.current = true;
    submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmit]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="chart"
          className="block text-xs tracking-widest text-ink-400 mb-1.5"
        >
          カルテ番号
        </label>
        <input
          id="chart"
          type="text"
          value={chartNumber}
          onChange={(e) => setChartNumber(e.target.value)}
          autoComplete="off"
          inputMode="text"
          className="block w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent tabular-nums"
          placeholder="例: A0001"
        />
      </div>

      <div>
        <label
          htmlFor="name"
          className="block text-xs tracking-widest text-ink-400 mb-1.5"
        >
          氏名（漢字）
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className="block w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="例: 山田 花子"
        />
        <p className="text-[11px] text-ink-400 mt-1">
          スペースは院に登録されている通りに入力してください
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 text-rose-700 text-sm px-3 py-2 border border-rose-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || !chartNumber || !name}
        className="block w-full text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition disabled:bg-ink-100 disabled:text-ink-300"
      >
        {submitting ? "確認中..." : "マイページへ"}
      </button>
    </form>
  );
}
