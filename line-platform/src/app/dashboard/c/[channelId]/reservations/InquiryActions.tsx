"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Pref = { date: string; time: string };
type Bed = { bedNumber: number; therapistName: string };

export function InquiryActions({
  channelId,
  inquiryId,
  status,
  visitType,
  prefs,
}: {
  channelId: string;
  inquiryId: string;
  status: string;
  visitType: string;
  prefs: Pref[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(prefs[0]?.date ?? "");
  const [time, setTime] = useState(prefs[0]?.time ?? "");
  const [beds, setBeds] = useState<Bed[] | null>(null);
  const [bedNumber, setBedNumber] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function setStatus(next: string) {
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/reservations/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    });
  }

  function pickPref(p: Pref) {
    setDate(p.date);
    setTime(p.time);
    setBeds(null);
    setBedNumber(null);
  }

  async function loadBeds() {
    setBusy(true);
    setErr(null);
    setBeds(null);
    setBedNumber(null);
    try {
      const q = new URLSearchParams({ date, time, visitType });
      const res = await fetch(`/api/channels/${channelId}/reservations/available-beds?${q}`);
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "取得に失敗しました");
        return;
      }
      setBeds(data.beds ?? []);
      if ((data.beds ?? []).length > 0) setBedNumber(data.beds[0].bedNumber);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (bedNumber == null) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/channels/${channelId}/reservations/inquiries/${inquiryId}/confirm`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ date, time, bedNumber }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "確定に失敗しました");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (status !== "pending") {
    return (
      <button
        onClick={() => setStatus("pending")}
        disabled={pending}
        className="border text-gray-500 text-xs px-2 py-1 rounded disabled:opacity-50"
      >
        未対応に戻す
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1 justify-end">
        <button
          onClick={() => setOpen((o) => !o)}
          className="bg-line text-white text-xs px-2 py-1 rounded"
        >
          {open ? "閉じる" : "確定する"}
        </button>
        <button
          onClick={() => setStatus("handled")}
          disabled={pending}
          className="border text-gray-600 text-xs px-2 py-1 rounded disabled:opacity-50"
        >
          対応済
        </button>
        <button
          onClick={() => setStatus("cancelled")}
          disabled={pending}
          className="border text-gray-600 text-xs px-2 py-1 rounded disabled:opacity-50"
        >
          キャンセル
        </button>
      </div>

      {open && (
        <div className="border rounded p-3 bg-gray-50 text-left space-y-2 w-72">
          {prefs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {prefs.map((p, i) => (
                <button
                  key={i}
                  onClick={() => pickPref(p)}
                  className={`text-xs px-2 py-0.5 rounded border ${
                    p.date === date && p.time === time ? "bg-line text-white border-line" : "bg-white"
                  }`}
                >
                  第{i + 1}: {p.date.slice(5).replace("-", "/")} {p.time}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setBeds(null); }}
              className="border rounded px-2 py-1 text-xs flex-1"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => { setTime(e.target.value); setBeds(null); }}
              className="border rounded px-2 py-1 text-xs w-24"
            />
          </div>
          <button
            onClick={loadBeds}
            disabled={busy || !date || !time}
            className="w-full border rounded text-xs py-1 disabled:opacity-50"
          >
            {busy ? "確認中…" : "空きベッドを確認"}
          </button>

          {beds && beds.length === 0 && (
            <div className="text-xs text-red-600">
              この日時に空いているベッドがありません。
              <Link href={`/dashboard/c/${channelId}/reservations/roster`} className="underline ml-1">
                担当を確認
              </Link>
            </div>
          )}
          {beds && beds.length > 0 && (
            <>
              <select
                value={bedNumber ?? ""}
                onChange={(e) => setBedNumber(Number(e.target.value))}
                className="w-full border rounded px-2 py-1 text-xs"
              >
                {beds.map((b) => (
                  <option key={b.bedNumber} value={b.bedNumber}>
                    ベッド#{b.bedNumber}（{b.therapistName || "担当未設定"}）
                  </option>
                ))}
              </select>
              <button
                onClick={confirm}
                disabled={busy || bedNumber == null}
                className="w-full bg-line text-white rounded text-xs py-1.5 disabled:opacity-50"
              >
                この内容で確定
              </button>
            </>
          )}
          {err && <div className="text-xs text-red-600">{err}</div>}
        </div>
      )}
    </div>
  );
}
