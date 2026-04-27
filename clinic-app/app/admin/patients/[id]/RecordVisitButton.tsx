"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  patientId: string;
  todayKey: string;
};

export default function RecordVisitButton({ patientId, todayKey }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  async function record() {
    setError(null);
    setSavedNotice(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/patients/${patientId}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visit_date: date }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json?.error === "future_date") {
          setError("未来の日付は記録できません");
        } else {
          setError("記録に失敗しました");
        }
        return;
      }
      setSavedNotice("記録しました");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="block w-full text-center rounded-full border-2 border-sky-500 bg-white text-sky-700 font-bold text-sm py-2.5 hover:bg-sky-50 transition"
      >
        + 来院を記録
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-ink-100 bg-white p-3 shadow-soft space-y-2">
          <label className="block text-[10px] tracking-widest text-ink-400">
            日付
          </label>
          <input
            type="date"
            value={date}
            max={todayKey}
            onChange={(e) => setDate(e.target.value)}
            className="block w-full min-w-0 appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {error && (
            <p className="text-[11px] text-rose-600">{error}</p>
          )}
          {savedNotice && (
            <p className="text-[11px] text-emerald-600">{savedNotice}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-full border border-ink-200 text-ink-700 text-xs py-2"
            >
              閉じる
            </button>
            <button
              type="button"
              onClick={record}
              disabled={busy || !date}
              className="flex-[2] rounded-full bg-sky-500 text-white font-bold text-xs py-2 hover:bg-sky-600 transition disabled:opacity-50"
            >
              {busy ? "記録中..." : "記録する"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
