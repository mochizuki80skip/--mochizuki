"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Referral = {
  id?: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export function ReferralSettings({
  channelId,
  initial,
}: {
  channelId: string;
  initial: Referral[];
}) {
  const router = useRouter();
  const [list, setList] = useState<Referral[]>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Referral>) {
    setList((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    setList((prev) => [
      ...prev,
      { name: "", sortOrder: prev.length + 1, isActive: true },
    ]);
  }
  function remove(i: number) {
    setList((prev) => prev.filter((_, idx) => idx !== i));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/reservations/referrals`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ referrals: list }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "保存に失敗しました");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="bg-white border rounded p-5 space-y-3">
      <h2 className="font-medium">知ったきっかけ（プルダウン項目）</h2>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500">
          <tr>
            <th className="px-2 py-1">選択肢</th>
            <th className="px-2 py-1 w-20">並び</th>
            <th className="px-2 py-1 w-16">有効</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={i} className="border-t">
              <td className="px-2 py-1">
                <input
                  value={r.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-sm"
                  placeholder="例：Instagram"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number"
                  value={r.sortOrder}
                  onChange={(e) => update(i, { sortOrder: Number(e.target.value) })}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </td>
              <td className="px-2 py-1 text-center">
                <input
                  type="checkbox"
                  checked={r.isActive}
                  onChange={(e) => update(i, { isActive: e.target.checked })}
                />
              </td>
              <td className="px-2 py-1 text-right">
                <button onClick={() => remove(i)} className="text-red-600 text-xs">
                  削除
                </button>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={4} className="px-2 py-3 text-gray-500 text-center">
                選択肢を追加してください
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button onClick={add} className="text-sm text-line-dark hover:underline">
          + 選択肢追加
        </button>
        <button
          onClick={save}
          disabled={pending}
          className="ml-auto bg-line text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </div>
  );
}
