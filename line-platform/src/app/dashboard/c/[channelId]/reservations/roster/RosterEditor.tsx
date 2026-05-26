"use client";

import { useCallback, useEffect, useState } from "react";

type Bed = { bedNumber: number; therapistName: string; acceptsNew: boolean };
type Break = { startTime: string; endTime: string };

function todayJst(): string {
  const now = new Date();
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}

function blankRows(n: number): Bed[] {
  return Array.from({ length: n }, (_, i) => ({
    bedNumber: i + 1,
    therapistName: "",
    acceptsNew: false,
  }));
}

export function RosterEditor({
  channelId,
  defaultBedCount,
}: {
  channelId: string;
  defaultBedCount: number;
}) {
  const [date, setDate] = useState(todayJst());
  const [rows, setRows] = useState<Bed[]>(blankRows(Math.max(1, defaultBedCount)));
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [openTime, setOpenTime] = useState("");
  const [closeTime, setCloseTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/channels/${channelId}/reservations/beds?date=${date}`);
      const data = await res.json();
      const beds: Bed[] = data.beds ?? [];
      if (beds.length > 0) {
        // 既存に空行を足して最低 defaultBedCount 行確保
        const maxNum = Math.max(...beds.map((b) => b.bedNumber), defaultBedCount);
        const map = new Map(beds.map((b) => [b.bedNumber, b]));
        setRows(
          Array.from({ length: maxNum }, (_, i) => {
            const n = i + 1;
            return map.get(n) ?? { bedNumber: n, therapistName: "", acceptsNew: false };
          }),
        );
      } else {
        setRows(blankRows(Math.max(1, defaultBedCount)));
      }
      setBreaks(
        (data.breaks ?? []).map((b: Break) => ({ startTime: b.startTime, endTime: b.endTime })),
      );
      setOpenTime(data.openTime ?? "");
      setCloseTime(data.closeTime ?? "");
    } finally {
      setLoading(false);
    }
  }, [channelId, date, defaultBedCount]);

  useEffect(() => {
    load();
  }, [load]);

  function update(i: number, patch: Partial<Bed>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [
      ...rs,
      { bedNumber: rs.length + 1, therapistName: "", acceptsNew: false },
    ]);
  }

  function updateBreak(i: number, patch: Partial<Break>) {
    setBreaks((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function addBreak() {
    setBreaks((bs) => [...bs, { startTime: "13:00", endTime: "14:00" }]);
  }
  function removeBreak(i: number) {
    setBreaks((bs) => bs.filter((_, idx) => idx !== i));
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/channels/${channelId}/reservations/beds`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, beds: rows, breaks, openTime, closeTime }),
      });
      const data = await res.json();
      setMsg(res.ok ? `保存しました（${data.count}ベッド）` : `エラー: ${data.error}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm">日付</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        />
        {loading && <span className="text-xs text-gray-400">読み込み中…</span>}
      </div>

      <div className="bg-white border rounded p-4 space-y-2">
        <div className="text-sm font-medium">この日の営業時間</div>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={openTime}
            onChange={(e) => setOpenTime(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
          <span className="text-gray-400">〜</span>
          <input
            type="time"
            value={closeTime}
            onChange={(e) => setCloseTime(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          />
        </div>
        <p className="text-xs text-gray-500">
          空欄のままなら「予約設定 → 営業時間」の曜日設定を使います。入力すると、この日だけその時間で空き状況を計算します。
        </p>
      </div>

      <div className="bg-white border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium w-20">ベッド</th>
              <th className="px-4 py-2 font-medium">施術者名</th>
              <th className="px-4 py-2 font-medium w-28 text-center">新規対応</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.bedNumber} className="border-t">
                <td className="px-4 py-2 text-gray-600">#{r.bedNumber}</td>
                <td className="px-4 py-2">
                  <input
                    value={r.therapistName}
                    onChange={(e) => update(i, { therapistName: e.target.value })}
                    placeholder="（空欄＝この日は未使用）"
                    className="border rounded px-2 py-1 w-full"
                  />
                </td>
                <td className="px-4 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={r.acceptsNew}
                    onChange={(e) => update(i, { acceptsNew: e.target.checked })}
                    className="w-4 h-4"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button onClick={addRow} className="border px-3 py-1.5 rounded text-sm">
        ＋ ベッドを追加
      </button>

      <div className="bg-white border rounded p-4 space-y-3">
        <div className="text-sm font-medium">休憩時間（この日）</div>
        <p className="text-xs text-gray-500">
          設定した時間帯は予約を受け付けず、当日タブには「休憩」と表示されます。1日に複数設定できます。
        </p>
        {breaks.length === 0 && (
          <p className="text-xs text-gray-400">休憩はありません。</p>
        )}
        {breaks.map((b, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="time"
              value={b.startTime}
              onChange={(e) => updateBreak(i, { startTime: e.target.value })}
              className="border rounded px-2 py-1 text-sm"
            />
            <span className="text-gray-400">〜</span>
            <input
              type="time"
              value={b.endTime}
              onChange={(e) => updateBreak(i, { endTime: e.target.value })}
              className="border rounded px-2 py-1 text-sm"
            />
            <button
              onClick={() => removeBreak(i)}
              className="text-xs text-red-600 border border-red-200 rounded px-2 py-1"
            >
              削除
            </button>
          </div>
        ))}
        <button onClick={addBreak} className="border px-3 py-1.5 rounded text-sm">
          ＋ 休憩を追加
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="bg-line text-white px-4 py-1.5 rounded text-sm disabled:opacity-50"
        >
          {saving ? "保存中…" : "この日の担当・休憩を保存"}
        </button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </div>
    </div>
  );
}
