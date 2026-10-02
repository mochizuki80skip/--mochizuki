"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ChannelNewForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#06C755");
  const [accessToken, setAccessToken] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    start(async () => {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || null,
          color,
          channelAccessToken: accessToken,
          channelSecret: secret,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "追加に失敗しました");
        return;
      }
      const j = await res.json();
      router.push(`/dashboard/c/${j.id}`);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border rounded p-5 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium">LINE アカウントの表示名</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
          placeholder="例: 本店LINE / 渋谷店LINE"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">説明（任意）</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
          placeholder="例: 整体院（本店）の予約・お問合せ用"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">アクセントカラー</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="mt-1 w-16 h-9 rounded border"
        />
      </div>

      <hr />

      <div>
        <label className="block text-sm font-medium">チャネルアクセストークン（長期）</label>
        <textarea
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono text-xs"
          rows={3}
          placeholder="LINE Developers Console > Messaging API 設定 > チャネルアクセストークン（長期）"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">チャネルシークレット</label>
        <input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono"
          placeholder="LINE Developers Console > チャネル基本設定 > チャネルシークレット"
          required
        />
      </div>

      <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded">
        💡 追加後、LINE Developers で Webhook URL を以下に設定してください：<br />
        <code className="text-xs">https://{`{ドメイン}`}/api/line/webhook/{`{追加後に表示されるID}`}</code>
      </div>

      <button
        onClick={submit}
        disabled={pending || !name || !accessToken || !secret}
        className="bg-line text-white px-4 py-2 rounded text-sm disabled:opacity-50"
      >
        {pending ? "追加中..." : "LINE アカウントを追加"}
      </button>
    </div>
  );
}
