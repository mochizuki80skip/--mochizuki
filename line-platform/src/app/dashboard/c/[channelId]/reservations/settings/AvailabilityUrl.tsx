"use client";

import { useEffect, useState } from "react";

export function AvailabilityUrl({ channelId, liffId }: { channelId: string; liffId: string }) {
  const [siteUrl, setSiteUrl] = useState("");
  useEffect(() => {
    setSiteUrl(`${window.location.origin}/liff/${channelId}`);
  }, [channelId]);

  const liffUrl = liffId ? `https://liff.line.me/${liffId}` : "";

  return (
    <div className="bg-line-light border border-line rounded p-5 space-y-3">
      <h2 className="font-medium text-line-dark">予約の空き状況サイト URL</h2>
      <p className="text-sm text-gray-700">
        お客様が空き状況を確認して予約できるページです。リッチメニューやメッセージのリンク先に設定してください。
      </p>

      <div>
        <label className="block text-xs font-medium text-gray-600">サイト URL（ブラウザでも開ける）</label>
        <div className="flex gap-2 mt-1">
          <input readOnly value={siteUrl} className="flex-1 border rounded px-3 py-2 text-sm font-mono bg-white" />
          <button onClick={() => navigator.clipboard.writeText(siteUrl)} className="border bg-white px-3 py-2 rounded text-sm">コピー</button>
          {siteUrl && (
            <a href={siteUrl} target="_blank" rel="noreferrer" className="border bg-white px-3 py-2 rounded text-sm">開く</a>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600">LINE 内で開く URL（LIFF）</label>
        {liffUrl ? (
          <div className="flex gap-2 mt-1">
            <input readOnly value={liffUrl} className="flex-1 border rounded px-3 py-2 text-sm font-mono bg-white" />
            <button onClick={() => navigator.clipboard.writeText(liffUrl)} className="border bg-white px-3 py-2 rounded text-sm">コピー</button>
          </div>
        ) : (
          <p className="text-xs text-orange-700 mt-1">
            ⚠️ 基本設定で LIFF ID を登録すると、LINE 内で開く URL が表示されます。リッチメニューにはこちらを使うと、お客様情報が自動取得できます。
          </p>
        )}
      </div>
    </div>
  );
}
