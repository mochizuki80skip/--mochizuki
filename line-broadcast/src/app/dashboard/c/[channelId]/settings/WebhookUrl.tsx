"use client";

import { useEffect, useState } from "react";

export function WebhookUrl({ channelId }: { channelId: string }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    setUrl(`${window.location.origin}/api/line/webhook/${channelId}`);
  }, [channelId]);

  return (
    <div className="bg-white border rounded p-5">
      <h2 className="font-medium mb-2">LINE Webhook URL</h2>
      <p className="text-sm text-gray-600 mb-2">
        LINE Developers Console → 該当チャネル → Messaging API 設定 → Webhook URL に以下を設定してください。
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={url}
          className="flex-1 border rounded px-3 py-2 text-sm font-mono"
        />
        <button
          onClick={() => navigator.clipboard.writeText(url)}
          className="border px-3 py-2 rounded text-sm"
        >
          コピー
        </button>
      </div>
    </div>
  );
}
