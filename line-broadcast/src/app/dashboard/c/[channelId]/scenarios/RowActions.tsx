"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Channel = { id: string; name: string };

export function RowActions({
  channelId,
  scenarioId,
  isActive,
  otherChannels,
}: {
  channelId: string;
  scenarioId: string;
  isActive: boolean;
  otherChannels: Channel[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [targets, setTargets] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const base = `/api/channels/${channelId}/scenarios/${scenarioId}`;

  async function call(url: string, init: RequestInit, onOk?: () => void) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "失敗しました");
      onOk?.();
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 text-right">
      <div className="flex justify-end gap-3 text-xs">
        <button
          disabled={busy}
          className="underline"
          onClick={() => call(base, { method: "PATCH", body: JSON.stringify({ isActive: !isActive }) })}
        >
          {isActive ? "無効にする" : "有効にする"}
        </button>
        {otherChannels.length > 0 && (
          <button className="underline" onClick={() => setCopyOpen((v) => !v)}>
            他の店舗へコピー
          </button>
        )}
        <button
          disabled={busy}
          className="underline text-red-600"
          onClick={() => {
            if (window.confirm("このシナリオを削除します（進行中の配信も止まります）。よろしいですか？")) {
              call(base, { method: "DELETE" });
            }
          }}
        >
          削除
        </button>
      </div>
      {copyOpen && (
        <div className="border rounded bg-gray-50 p-3 text-left text-sm space-y-2">
          <div className="text-xs text-gray-500">
            コピー先では<b>「無効」</b>で作成されます。内容を確認して有効にしてください。タグがトリガーの場合、コピー先に同名タグが無ければ作成されます。
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {otherChannels.map((c) => (
              <label key={c.id} className="flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={targets.includes(c.id)}
                  onChange={() => setTargets((t) => (t.includes(c.id) ? t.filter((x) => x !== c.id) : [...t, c.id]))}
                />
                {c.name}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              disabled={busy || targets.length === 0}
              className="bg-line text-white rounded px-3 py-1 text-xs disabled:opacity-50"
              onClick={() =>
                call(`${base}/copy`, { method: "POST", body: JSON.stringify({ channelIds: targets }) }, () => {
                  setCopyOpen(false);
                  setTargets([]);
                  setMessage("コピーしました（コピー先は無効状態です）");
                })
              }
            >
              コピーする
            </button>
            <button className="text-xs underline" onClick={() => setCopyOpen(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
      {message && <div className="text-xs text-gray-600">{message}</div>}
    </div>
  );
}
