"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Service = {
  id?: string;
  name: string;
  durationMinutes: number;
  price: number;
  sortOrder: number;
  isActive: boolean;
};

export function ServicesSettings({
  channelId,
  initial,
  slotMinutes,
}: {
  channelId: string;
  initial: Service[];
  slotMinutes: number;
}) {
  const router = useRouter();
  const [list, setList] = useState<Service[]>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Service>) {
    setList((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function add() {
    setList((prev) => [
      ...prev,
      {
        name: "",
        durationMinutes: slotMinutes,
        price: 0,
        sortOrder: prev.length + 1,
        isActive: true,
      },
    ]);
  }
  function remove(i: number) {
    setList((prev) => prev.filter((_, idx) => idx !== i));
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/reservations/services`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ services: list }),
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
      <h2 className="font-medium">メニュー</h2>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500">
          <tr>
            <th className="px-2 py-1">名前</th>
            <th className="px-2 py-1 w-24">所要分</th>
            <th className="px-2 py-1 w-28">価格（円）</th>
            <th className="px-2 py-1 w-20">並び</th>
            <th className="px-2 py-1 w-16">有効</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((s, i) => (
            <tr key={i} className="border-t">
              <td className="px-2 py-1">
                <input
                  value={s.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number"
                  min={slotMinutes}
                  step={slotMinutes}
                  value={s.durationMinutes}
                  onChange={(e) => update(i, { durationMinutes: Number(e.target.value) })}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={s.price}
                  onChange={(e) => update(i, { price: Number(e.target.value) })}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </td>
              <td className="px-2 py-1">
                <input
                  type="number"
                  value={s.sortOrder}
                  onChange={(e) => update(i, { sortOrder: Number(e.target.value) })}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </td>
              <td className="px-2 py-1 text-center">
                <input
                  type="checkbox"
                  checked={s.isActive}
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
              <td colSpan={6} className="px-2 py-3 text-gray-500 text-center">
                メニューを追加してください
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button onClick={add} className="text-sm text-line-dark hover:underline">
          + メニュー追加
        </button>
        <button
          onClick={save}
          disabled={pending}
          className="ml-auto bg-line text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          保存
        </button>
      </div>
      <p className="text-xs text-gray-500">
        💡 所要分は時間粒度（{slotMinutes}分）の倍数で指定してください。
      </p>
    </div>
  );
}
