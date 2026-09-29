"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Rule = { id: string; keyword: string; matchType: string; isActive: boolean; preview: string };

export function AutoReplyManager({ channelId, initial }: { channelId: string; initial: Rule[] }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [matchType, setMatchType] = useState<"exact" | "contains">("exact");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create() {
    if (!keyword.trim() || !text.trim()) return;
    setError(null);
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/auto-replies`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim(), matchType, messages: [{ type: "text", text }] }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error ?? "失敗しました");
        return;
      }
      setKeyword("");
      setText("");
      router.refresh();
    });
  }

  function toggle(r: Rule) {
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/auto-replies/${r.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      if (res.ok) router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("この自動応答を削除しますか？")) return;
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/auto-replies/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded p-4 space-y-3 max-w-2xl">
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="キーワード / ポストバック data"
            className="border rounded px-3 py-1.5 text-sm flex-1"
          />
          <select
            value={matchType}
            onChange={(e) => setMatchType(e.target.value as "exact" | "contains")}
            className="border rounded px-2 py-1.5 text-sm"
          >
            <option value="exact">完全一致</option>
            <option value="contains">部分一致</option>
          </select>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="返信内容"
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <button
          onClick={create}
          disabled={pending}
          className="bg-line text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
        >
          追加
        </button>
      </div>

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">キーワード</th>
              <th className="px-4 py-2 font-medium">一致</th>
              <th className="px-4 py-2 font-medium">返信内容</th>
              <th className="px-4 py-2 font-medium">状態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2 font-medium">{r.keyword}</td>
                <td className="px-4 py-2">{r.matchType === "exact" ? "完全" : "部分"}</td>
                <td className="px-4 py-2 text-gray-600 truncate max-w-xs">{r.preview}</td>
                <td className="px-4 py-2">
                  <button onClick={() => toggle(r)} className="text-xs hover:underline">
                    {r.isActive ? (
                      <span className="text-line-dark">有効</span>
                    ) : (
                      <span className="text-gray-400">無効</span>
                    )}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(r.id)} className="text-red-600 text-xs hover:underline">
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-sm text-gray-500">
                  自動応答がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
