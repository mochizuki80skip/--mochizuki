"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QuotaSummary } from "@/lib/line";

type Row = { id: string; name: string; color: string; followers: number; quota: QuotaSummary | null };

export function MultiBroadcastForm({ channels }: { channels: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const overQuota = channels.filter(
    (c) => selected.includes(c.id) && c.quota?.remaining != null && c.followers > c.quota.remaining,
  );

  function submit(action: "save" | "send" | "schedule") {
    setError(null);
    if (action === "send" && !confirm(`${selected.length} アカウントにいますぐ配信しますか？`)) return;
    start(async () => {
      const body: Record<string, unknown> = {
        channelIds: selected,
        title,
        messages: [{ type: "text", text }],
      };
      if (action === "schedule") body.scheduledAt = new Date(scheduledAt).toISOString();
      if (action === "send") body.sendNow = true;

      const res = await fetch("/api/broadcasts/multi", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        const failed = (data.results ?? []).filter((r: { ok: boolean }) => !r.ok) as {
          channelId: string;
          error?: string;
        }[];
        const names = failed.map((f) => {
          const c = channels.find((x) => x.id === f.channelId);
          return `${c?.name ?? f.channelId}: ${f.error ?? "失敗"}`;
        });
        setError(names.length ? names.join("\n") : data.error ?? "失敗しました");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="bg-white border rounded p-5 space-y-4">
      {error && <div className="text-sm text-red-600 whitespace-pre-wrap">{error}</div>}

      <div>
        <label className="block text-sm font-medium">配信するアカウント</label>
        <div className="mt-2 border rounded divide-y">
          {channels.map((c) => (
            <label key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer">
              <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.color }} />
              <span className="flex-1">{c.name}</span>
              <span className="text-gray-500">友だち {c.followers}</span>
              <span className="text-gray-500 w-40 text-right">
                {c.quota == null
                  ? "残り枠：取得失敗"
                  : c.quota.remaining == null
                    ? `今月 ${c.quota.used} 通（上限なし）`
                    : `残り ${c.quota.remaining} / ${c.quota.limit} 通`}
              </span>
            </label>
          ))}
          {channels.length === 0 && <div className="px-3 py-4 text-sm text-gray-500">アカウントがありません</div>}
        </div>
        {overQuota.length > 0 && (
          <div className="mt-2 text-sm text-amber-700">
            残り枠が友だち数より少ないアカウントがあります（{overQuota.map((c) => c.name).join("、")}）。上限超過時は LINE 側で配信が拒否されます。
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">タイトル（管理用）</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">本文（テキスト）</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">予約日時（任意）</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="mt-1 border rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => submit("save")}
          disabled={pending || selected.length === 0 || !title || !text}
          className="border px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          下書き保存
        </button>
        <button
          type="button"
          onClick={() => submit("schedule")}
          disabled={pending || selected.length === 0 || !title || !text || !scheduledAt}
          className="border px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          予約配信
        </button>
        <button
          type="button"
          onClick={() => submit("send")}
          disabled={pending || selected.length === 0 || !title || !text}
          className="bg-line text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          いますぐ配信
        </button>
      </div>
    </div>
  );
}
