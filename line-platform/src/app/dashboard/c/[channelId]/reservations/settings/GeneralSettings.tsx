"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function GeneralSettings({
  channelId,
  initial,
  sheetMode = false,
}: {
  channelId: string;
  sheetMode?: boolean;
  initial: {
    isEnabled: boolean;
    slotMinutes: number;
    defaultBedCount: number;
    bookingHorizonDays: number;
    bookingLeadHours: number;
    clinicName: string;
    clinicAddress: string;
    clinicPhone: string;
    clinicPhotoUrl: string;
    themeColor: string;
    liffId: string;
    sendConfirmMessage: boolean;
    confirmMessageTemplate: string;
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

  // 画像を最大800pxのJPEGに圧縮して data URL 化
  async function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const img = new Image();
    img.onload = () => {
      const maxDim = 800;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else { width = Math.round((width * maxDim) / height); height = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", 0.82);
      update("clinicPhotoUrl", compressed);
    };
    img.src = dataUrl;
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
      <h2 className="font-medium">基本設定</h2>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {saved && <div className="text-sm text-line-dark">保存しました</div>}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={v.isEnabled}
          onChange={(e) => update("isEnabled", e.target.checked)}
        />
        <span className="text-sm font-medium">予約機能を有効化する</span>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">院名</label>
          <input
            value={v.clinicName}
            onChange={(e) => update("clinicName", e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
            placeholder="例：○○接骨院"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">電話番号</label>
          <input
            value={v.clinicPhone}
            onChange={(e) => update("clinicPhone", e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium">住所</label>
          <input
            value={v.clinicAddress}
            onChange={(e) => update("clinicAddress", e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium">店舗写真</label>
          <div className="mt-1 flex items-center gap-3">
            {v.clinicPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.clinicPhotoUrl} alt="店舗" className="w-24 h-24 object-cover rounded border" />
            ) : (
              <div className="w-24 h-24 rounded border bg-gray-100 flex items-center justify-center text-xs text-gray-400">未設定</div>
            )}
            <div className="flex flex-col gap-1">
              <input type="file" accept="image/*" onChange={onPhotoChange} className="text-sm" />
              {v.clinicPhotoUrl && (
                <button type="button" onClick={() => update("clinicPhotoUrl", "")} className="text-xs text-red-600 self-start">
                  写真を削除
                </button>
              )}
              <span className="text-xs text-gray-500">確認画面に表示されます（自動で圧縮）</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {!sheetMode && (
          <div>
            <label className="block text-sm font-medium">時間粒度（分）</label>
            <input
              type="number"
              min={5}
              step={5}
              value={v.slotMinutes}
              onChange={(e) => update("slotMinutes", Number(e.target.value))}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        )}
        {!sheetMode && (
          <div>
            <label className="block text-sm font-medium">ベッド数（同時受入）</label>
            <input
              type="number"
              min={1}
              value={v.defaultBedCount}
              onChange={(e) => update("defaultBedCount", Number(e.target.value))}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">アクセントカラー</label>
          <input
            type="color"
            value={v.themeColor}
            onChange={(e) => update("themeColor", e.target.value)}
            className="mt-1 w-16 h-9 rounded border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">受付：何日先まで</label>
          <input
            type="number"
            min={1}
            value={v.bookingHorizonDays}
            onChange={(e) => update("bookingHorizonDays", Number(e.target.value))}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">受付締切：何時間前</label>
          <input
            type="number"
            min={0}
            value={v.bookingLeadHours}
            onChange={(e) => update("bookingLeadHours", Number(e.target.value))}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      <hr />

      <div>
        <label className="block text-sm font-medium">LIFF ID</label>
        <input
          value={v.liffId}
          onChange={(e) => update("liffId", e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 text-sm font-mono"
          placeholder="例：1234567890-abcdefgh"
        />
        <p className="text-xs text-gray-500 mt-1">
          LINE Developers Console で作成した LIFF アプリの ID。
          LIFF Endpoint URL は <code>https://your-domain/liff/{channelId}</code> を指定。
        </p>
      </div>

      <hr />

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={v.sendConfirmMessage}
          onChange={(e) => update("sendConfirmMessage", e.target.checked)}
        />
        <span className="text-sm font-medium">予約完了時に LINE で確認メッセージを自動送信</span>
      </label>
      {v.sendConfirmMessage && (
        <div>
          <label className="block text-sm font-medium">テンプレート</label>
          <textarea
            value={v.confirmMessageTemplate}
            onChange={(e) => update("confirmMessageTemplate", e.target.value)}
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
            rows={4}
            placeholder="例：ご予約承りました。\n{date} {time} {menu}でお待ちしております。"
          />
          <p className="text-xs text-gray-500 mt-1">
            利用可能変数: <code>{"{date}"}</code> <code>{"{time}"}</code> <code>{"{menu}"}</code> <code>{"{name}"}</code>
          </p>
        </div>
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
