"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ChannelSettingsForm({
  channelId,
  initial,
  readOnly,
}: {
  channelId: string;
  initial: { name: string; description: string; color: string; isActive: boolean };
  readOnly: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [color, setColor] = useState(initial.color);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const body: Record<string, unknown> = { name, description, color, isActive };
      if (token) body.channelAccessToken = token;
      if (secret) body.channelSecret = secret;

      const res = await fetch(`/api/channels/${channelId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "保存に失敗しました");
        return;
      }
      setSaved(true);
      setToken("");
      setSecret("");
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function remove() {
    if (!confirm("この LINE アカウントを削除しますか？\n\n友だち、タグ、配信、シナリオなどすべてのデータが消えます。")) return;
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}`, { method: "DELETE" });
      if (res.ok) router.push("/dashboard");
    });
  }

  const disabled = readOnly || pending;

  return (
    <div className="bg-white border rounded p-5 space-y-4">
      <h2 className="font-medium">LINE アカウント設定</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-line-light border border-line text-line-dark text-sm p-3 rounded">
          保存しました
        </div>
      )}

      <div>
        <label className="block text-sm font-medium">表示名</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">説明</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled}
          className="mt-1 w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50"
        />
      </div>

      <div className="flex items-center gap-3">
        <div>
          <label className="block text-sm font-medium">カラー</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={disabled}
            className="mt-1 w-16 h-9 rounded border disabled:opacity-50"
          />
        </div>
        <label className="flex items-center gap-2 mt-7 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            disabled={disabled}
          />
          有効
        </label>
      </div>

      <hr />

      <div>
        <h3 className="text-sm font-medium mb-1">トークン再設定（任意）</h3>
        <p className="text-xs text-gray-500 mb-2">
          トークンを変更したい場合のみ入力してください（空欄なら現在の値を保持）。
        </p>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={disabled}
          placeholder="チャネルアクセストークン（長期）"
          className="mt-1 w-full border rounded px-3 py-2 text-xs font-mono disabled:bg-gray-50"
          rows={2}
        />
        <input
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          disabled={disabled}
          placeholder="チャネルシークレット"
          className="mt-2 w-full border rounded px-3 py-2 text-xs font-mono disabled:bg-gray-50"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={save}
          disabled={disabled}
          className="bg-line text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          保存
        </button>
        {!readOnly && (
          <button
            onClick={remove}
            disabled={pending}
            className="text-red-600 border border-red-300 px-4 py-2 rounded text-sm disabled:opacity-50 ml-auto"
          >
            この LINE アカウントを削除
          </button>
        )}
      </div>
    </div>
  );
}
