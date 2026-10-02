"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CampaignActions({
  id,
  canSend,
  canCancel,
  targetCount,
}: {
  id: string;
  canSend: boolean;
  canCancel: boolean;
  targetCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "execute" | "cancel") {
    const msg =
      action === "execute"
        ? `${targetCount} アカウントにいま配信します。よろしいですか？`
        : "未送信の配信を取り消します。よろしいですか？";
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "失敗しました");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex gap-2">
        {canSend && (
          <button disabled={busy} onClick={() => call("execute")} className="bg-line text-white rounded px-4 py-2 text-sm disabled:opacity-50">
            {busy ? "処理中…" : "いますぐ配信"}
          </button>
        )}
        {canCancel && (
          <button disabled={busy} onClick={() => call("cancel")} className="border rounded px-4 py-2 text-sm bg-white disabled:opacity-50">
            配信を取り消す
          </button>
        )}
      </div>
    </div>
  );
}
