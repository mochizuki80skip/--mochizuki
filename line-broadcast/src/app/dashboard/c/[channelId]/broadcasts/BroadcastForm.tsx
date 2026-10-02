"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Tag = { id: string; name: string; color: string };

export function BroadcastForm({ channelId, tags }: { channelId: string; tags: Tag[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [targetTagIds, setTargetTagIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggleTag(id: string) {
    setTargetTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function submit(action: "save" | "send" | "schedule") {
    setError(null);
    start(async () => {
      const messages = [{ type: "text", text }];
      const body: Record<string, unknown> = {
        title,
        messages,
        tagIds: targetTagIds,
        targetAllFollowers: targetTagIds.length === 0,
      };
      if (action === "schedule") body.scheduledAt = scheduledAt;
      if (action === "send") body.sendNow = true;

      const res = await fetch(`/api/channels/${channelId}/broadcasts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error ?? "失敗しました");
        return;
      }
      router.push(`/dashboard/c/${channelId}/broadcasts`);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border rounded p-5 space-y-4 max-w-2xl">
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div>
        <label className="block text-sm font-medium">タイトル（管理用）</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">本文（テキスト）</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">配信先タグ（未選択 = 全員）</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.length === 0 && <span className="text-sm text-gray-500">タグ未登録</span>}
          {tags.map((t) => {
            const on = targetTagIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                className="px-3 py-1 rounded text-sm border"
                style={{
                  background: on ? t.color : "white",
                  color: on ? "white" : t.color,
                  borderColor: t.color,
                }}
              >
                {t.name}
              </button>
            );
          })}
        </div>
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
          disabled={pending}
          className="border px-4 py-2 rounded text-sm"
        >
          下書き保存
        </button>
        <button
          type="button"
          onClick={() => submit("schedule")}
          disabled={pending || !scheduledAt}
          className="border px-4 py-2 rounded text-sm"
        >
          予約配信
        </button>
        <button
          type="button"
          onClick={() => submit("send")}
          disabled={pending}
          className="bg-line text-white px-4 py-2 rounded text-sm"
        >
          いますぐ配信
        </button>
      </div>
    </div>
  );
}
