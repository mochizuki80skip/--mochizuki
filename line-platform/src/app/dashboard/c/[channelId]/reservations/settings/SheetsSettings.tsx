"use client";

import { useState, useTransition } from "react";

export function SheetsSettings({
  channelId,
  initial,
}: {
  channelId: string;
  initial: { spreadsheetId: string; sheetTabReservations: string };
}) {
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function update<K extends keyof typeof v>(key: K, value: (typeof v)[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/reservations/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spreadsheetId: v.spreadsheetId || null,
          sheetTabReservations: v.sheetTabReservations,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "保存に失敗しました");
        return;
      }
      setInfo("保存しました");
      setTimeout(() => setInfo(null), 2000);
    });
  }

  function verify() {
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/reservations/sheets/verify`, {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) {
        setError(j.error ?? "アクセスに失敗しました");
        return;
      }
      setInfo(`接続成功：${j.title}`);
    });
  }

  function syncSheet() {
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/reservations/sheets/sync`, {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "同期に失敗しました");
        return;
      }
      setInfo("同期しました（予約 / スケジュール / 設定 / メニュー / 営業時間 / きっかけ）");
    });
  }

  return (
    <div className="bg-white border rounded p-5 space-y-3">
      <h2 className="font-medium">スプレッドシート連携</h2>

      <p className="text-xs text-gray-600">
        Google Sheets の URL から ID をコピーして貼り付けてください：
        <br />
        <code className="text-[10px]">
          https://docs.google.com/spreadsheets/d/<b>【この部分】</b>/edit...
        </code>
        <br />
        その後、サービスアカウントのメールアドレスを編集者として共有する必要があります（環境変数の説明書参照）。
      </p>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {info && <div className="text-sm text-line-dark">{info}</div>}

      <div>
        <label className="block text-sm font-medium">スプレッドシート ID</label>
        <input
          value={v.spreadsheetId}
          onChange={(e) => update("spreadsheetId", e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono"
          placeholder="1AbcDeFgHiJkLmNoPqRsTuVwXyZ1234567890"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">予約タブ名</label>
        <input
          value={v.sheetTabReservations}
          onChange={(e) => update("sheetTabReservations", e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
          placeholder="予約"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={save}
          disabled={pending}
          className="bg-line text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          保存
        </button>
        <button
          onClick={verify}
          disabled={pending || !v.spreadsheetId}
          className="border px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          接続テスト
        </button>
        <button
          onClick={syncSheet}
          disabled={pending || !v.spreadsheetId}
          className="border border-line text-line-dark px-4 py-2 rounded text-sm disabled:opacity-50 ml-auto"
          title="スプレッドシートの全タブを最新の予約データと設定で再生成します"
        >
          📋 シートを完全同期
        </button>
      </div>

      <details className="text-xs text-gray-600 pt-2 border-t">
        <summary className="cursor-pointer">「シートを完全同期」ボタンの動作</summary>
        <div className="mt-2 space-y-1">
          <p>このボタンを押すと、以下のタブがアプリの最新データで上書きされます：</p>
          <ul className="list-disc ml-5">
            <li><b>予約</b>：ヘッダー行のみセット（既存データは保持）</li>
            <li><b>スケジュール</b>：今日から最大30日先までの空き状況マトリクス（再生成）</li>
            <li><b>設定</b>：ベッド数・営業情報など（再生成）</li>
            <li><b>メニュー</b>：登録メニュー一覧（再生成）</li>
            <li><b>営業時間</b>：曜日別営業時間（再生成）</li>
            <li><b>きっかけ</b>：選択肢一覧（再生成）</li>
          </ul>
          <p className="text-orange-700">⚠️ スケジュール／設定／メニュー／営業時間／きっかけタブを Sheet 上で編集していても、同期時に上書きされます。</p>
        </div>
      </details>
    </div>
  );
}
