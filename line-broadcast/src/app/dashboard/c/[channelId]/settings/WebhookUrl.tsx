"use client";

import { useEffect, useState } from "react";

export function WebhookUrl({ channelId }: { channelId: string }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    setUrl(`${window.location.origin}/api/line/webhook/${channelId}`);
  }, [channelId]);

  return (
    <div className="bg-white border rounded p-5">
      <h2 className="font-medium mb-2">LINE Webhook URL（アカウントごとに異なります）</h2>
      <ol className="text-sm text-gray-600 mb-3 list-decimal pl-5 space-y-0.5">
        <li>下の URL をコピー</li>
        <li>LINE Developers Console → 該当チャネル →「Messaging API設定」→「Webhook URL」に貼り付けて更新</li>
        <li>「検証」を押して成功を確認</li>
        <li>「Webhookの利用」をオンにする</li>
      </ol>
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
