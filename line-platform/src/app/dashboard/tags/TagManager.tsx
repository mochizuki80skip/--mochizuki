"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Tag = { id: string; name: string; color: string; count: number };

export function TagManager({ initial }: { initial: Tag[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#06C755");
  const [pending, start] = useTransition();

  function create() {
    if (!name.trim()) return;
    start(async () => {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });
      if (res.ok) {
        setName("");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("このタグを削除しますか？（友だちからも外れます）")) return;
    start(async () => {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded p-4 flex gap-2 items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="タグ名"
          className="border rounded px-3 py-1.5 text-sm flex-1"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-9 rounded border"
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
              <th className="px-4 py-2 font-medium">タグ</th>
              <th className="px-4 py-2 font-medium">友だち数</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {initial.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-2">
                  <span
                    className="px-2 py-0.5 rounded text-xs"
                    style={{ background: t.color + "20", color: t.color }}
                  >
                    {t.name}
                  </span>
                </td>
                <td className="px-4 py-2">{t.count}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(t.id)} className="text-red-600 text-xs hover:underline">
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {initial.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-sm text-gray-500">
                  タグがありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
