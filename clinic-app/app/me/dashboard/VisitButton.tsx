"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  /** Has the patient already recorded a visit for today? */
  recordedToday: boolean;
  /** Today as YYYY-MM-DD; passed in so the server clock is the source of truth. */
  todayKey: string;
};

export default function VisitButton({ recordedToday, todayKey }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function record() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setError("記録に失敗しました");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    const ok = window.confirm("今日の来院記録を取り消しますか？");
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/me/visits/${todayKey}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("取り消しに失敗しました");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  if (recordedToday) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-full border border-sky-300 bg-sky-50 text-sky-700 font-bold tracking-widest py-3 px-5">
        <span aria-hidden>✓</span>
        <span className="text-sm">今日の来院 記録済み</span>
        <button
          type="button"
          onClick={undo}
          disabled={busy}
          className="ml-auto text-[11px] text-sky-700 underline hover:no-underline"
        >
          取り消す
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={record}
        disabled={busy}
        className="mb-3 block w-full rounded-full border-2 border-sky-500 bg-white text-sky-700 font-black tracking-widest py-3 px-5 hover:bg-sky-50 active:scale-[0.99] transition disabled:opacity-50"
      >
        {busy ? "記録中..." : "✓ 今日の来院を記録"}
      </button>
      {error && (
        <p className="mb-3 text-xs text-rose-600 text-center">{error}</p>
      )}
    </>
  );
}
