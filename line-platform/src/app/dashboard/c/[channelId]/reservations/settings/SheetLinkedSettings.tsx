"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SheetLinkedSettings({
  channelId,
  initial,
}: {
  channelId: string;
  initial: {
    sheetLinkedMode: boolean;
    sheetTabInquiry: string;
    slotMinutes: number;
    newPatientDurationMinutes: number;
    returningDurationMinutes: number;
    lowStockThreshold: number;
    inquiryReplyMessage: string;
  };
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof v>(key: K, value: (typeof v)[K]) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/reservations/settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(v),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "保存に失敗しました");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border rounded p-5 space-y-4">
      <h2 className="font-medium">シート連動モード（接骨院方式）</h2>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {saved && <div className="text-sm text-line-dark">保存しました</div>}

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={v.sheetLinkedMode}
          onChange={(e) => update("sheetLinkedMode", e.target.checked)}
          className="mt-1"
        />
        <span className="text-sm">
          <b>シート連動モードを有効化する</b>
          <br />
          <span className="text-gray-600 text-xs">
            ON にすると接骨院方式になります。空き状況は管理画面の「ベッド担当」と確定予約から自動計算します。
            お客様の予約リクエストは「問い合わせ一覧」へ追記＋LINEで確認中メッセージを送り、
            確定・案内送信・キャンセルはすべて管理画面で行います。
            スプレッドシートの当日タブ（M/D）はアプリが自動生成する閲覧用です（手入力不要）。
          </span>
        </span>
      </label>

      {v.sheetLinkedMode && (
        <>
          <div>
            <label className="block text-sm font-medium">予約枠の刻み幅（分）</label>
            <input
              type="number"
              min={5}
              step={5}
              value={v.slotMinutes}
              onChange={(e) => update("slotMinutes", Number(e.target.value))}
              className="mt-1 w-32 border rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              営業時間をこの幅で区切って予約枠を作ります（例: 15 → 15分刻み）。当日タブの行もこの幅になります。
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">新規の所要時間（分）</label>
              <input
                type="number"
                min={5}
                step={5}
                value={v.newPatientDurationMinutes}
                onChange={(e) => update("newPatientDurationMinutes", Number(e.target.value))}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">新規は :00 / :30 のみ予約可能</p>
            </div>
            <div>
              <label className="block text-sm font-medium">2回目以降の所要時間（分）</label>
              <input
                type="number"
                min={5}
                step={5}
                value={v.returningDurationMinutes}
                onChange={(e) => update("returningDurationMinutes", Number(e.target.value))}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium">△（残りわずか）の閾値</label>
            <input
              type="number"
              min={0}
              value={v.lowStockThreshold}
              onChange={(e) => update("lowStockThreshold", Number(e.target.value))}
              className="mt-1 w-32 border rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              残り枠がこの数以下のとき、カレンダーに △ を表示します（0 で △ 無効）。例: 1 → 残り1枠で △
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium">問い合わせ一覧タブ名</label>
            <input
              value={v.sheetTabInquiry}
              onChange={(e) => update("sheetTabInquiry", e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="問い合わせ一覧"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">「確認中」メッセージ文面</label>
            <textarea
              value={v.inquiryReplyMessage}
              onChange={(e) => update("inquiryReplyMessage", e.target.value)}
              rows={5}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder={"ご予約リクエストありがとうございます。\n内容を確認のうえ、改めてご連絡いたします。少々お待ちくださいませ。\n\n▼ご希望\n日時: {date} {time}\nメニュー: {menu}\nお名前: {name}"}
            />
            <p className="text-xs text-gray-500 mt-1">
              利用可能変数: <code>{"{date}"}</code> <code>{"{time}"}</code> <code>{"{menu}"}</code> <code>{"{name}"}</code>（空欄ならデフォルト文）
            </p>
          </div>
        </>
      )}

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
