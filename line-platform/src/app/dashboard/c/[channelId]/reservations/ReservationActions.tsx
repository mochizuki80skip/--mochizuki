"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReservationActions({
  channelId,
  reservationId,
  hasLineUser,
  alreadySent,
}: {
  channelId: string;
  reservationId: string;
  hasLineUser: boolean;
  alreadySent: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send() {
    const ok = window.confirm(
      alreadySent
        ? "すでに案内を送信済みです。もう一度送信しますか？"
        : "確定案内を公式LINEで送信します。よろしいですか？",
    );
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/channels/${channelId}/reservations/${reservationId}/send-confirm`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "送信に失敗しました");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!window.confirm("この予約をキャンセルしますか？")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/channels/${channelId}/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "キャンセルに失敗しました");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1 justify-end">
        <button
          onClick={send}
          disabled={busy || !hasLineUser}
          title={hasLineUser ? "" : "LINE userId が無いため送信できません"}
          className="bg-line text-white text-xs px-2 py-1 rounded disabled:opacity-40"
        >
          {alreadySent ? "再送信" : "LINE案内を送る"}
        </button>
        <button
          onClick={cancel}
          disabled={busy}
          className="border text-gray-600 text-xs px-2 py-1 rounded disabled:opacity-50"
        >
          取消
        </button>
      </div>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
