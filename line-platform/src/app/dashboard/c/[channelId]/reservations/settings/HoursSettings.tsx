"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Hours = {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
};

const DAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function HoursSettings({
  channelId,
  initial,
}: {
  channelId: string;
  initial: Hours[];
}) {
  const router = useRouter();
  const [list, setList] = useState<Hours[]>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(dow: number, patch: Partial<Hours>) {
    setList((prev) =>
      prev.map((h) => (h.dayOfWeek === dow ? { ...h, ...patch } : h)),
    );
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/reservations/hours`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hours: list }),
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
      <h2 className="font-medium">営業時間</h2>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500">
          <tr>
            <th className="px-2 py-1 w-12">曜日</th>
            <th className="px-2 py-1 w-20">定休</th>
            <th className="px-2 py-1">開店</th>
            <th className="px-2 py-1">閉店</th>
          </tr>
        </thead>
        <tbody>
          {list.map((h) => (
            <tr key={h.dayOfWeek} className="border-t">
              <td className="px-2 py-2 font-medium">{DAYS[h.dayOfWeek]}</td>
              <td className="px-2 py-2 text-center">
                <input
                  type="checkbox"
                  checked={h.isClosed}
                  onChange={(e) => update(h.dayOfWeek, { isClosed: e.target.checked })}
                />
              </td>
              <td className="px-2 py-2">
                <input
                  type="time"
                  step={300}
                  value={h.openTime}
                  disabled={h.isClosed}
                  onChange={(e) => update(h.dayOfWeek, { openTime: e.target.value })}
                  className="border rounded px-2 py-1 text-sm disabled:bg-gray-100"
                />
              </td>
              <td className="px-2 py-2">
                <input
                  type="time"
                  step={300}
                  value={h.closeTime}
                  disabled={h.isClosed}
                  onChange={(e) => update(h.dayOfWeek, { closeTime: e.target.value })}
                  className="border rounded px-2 py-1 text-sm disabled:bg-gray-100"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={save}
        disabled={pending}
        className="bg-line text-white px-4 py-2 rounded text-sm disabled:opacity-50"
      >
        保存
      </button>
    </div>
  );
}
