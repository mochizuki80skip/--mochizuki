"use client";

import { useEffect, useRef, useState, useTransition } from "react";

type ActionType = "reservation" | "uri" | "message";
type ButtonConfig = {
  label: string;
  actionType: ActionType;
  value: string;
  bgColor: string;
  textColor: string;
};

type Initial = {
  size: "large" | "compact";
  layout: "1" | "2" | "3" | "4" | "6";
  chatBarText: string;
  buttons: ButtonConfig[];
  isApplied: boolean;
} | null;

const SIZES = {
  large: { w: 2500, h: 1686 },
  compact: { w: 2500, h: 843 },
};

// レイアウトごとの矩形（クライアント側プレビュー用・サーバーと同じロジック）
function layoutBounds(layout: string, size: "large" | "compact") {
  const { w: W, h: H } = SIZES[size];
  switch (layout) {
    case "1": return [{ x: 0, y: 0, width: W, height: H }];
    case "2": return [
      { x: 0, y: 0, width: W / 2, height: H },
      { x: W / 2, y: 0, width: W / 2, height: H },
    ];
    case "3": return [
      { x: 0, y: 0, width: Math.floor(W / 3), height: H },
      { x: Math.floor(W / 3), y: 0, width: Math.floor(W / 3), height: H },
      { x: Math.floor((W / 3) * 2), y: 0, width: W - Math.floor((W / 3) * 2), height: H },
    ];
    case "4": {
      const hw = W / 2, hh = H / 2;
      return [
        { x: 0, y: 0, width: hw, height: hh },
        { x: hw, y: 0, width: hw, height: hh },
        { x: 0, y: hh, width: hw, height: hh },
        { x: hw, y: hh, width: hw, height: hh },
      ];
    }
    case "6": {
      const tw = Math.floor(W / 3), hh = H / 2;
      const b: { x: number; y: number; width: number; height: number }[] = [];
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        b.push({ x: c === 2 ? tw * 2 : tw * c, y: r * hh, width: c === 2 ? W - tw * 2 : tw, height: hh });
      }
      return b;
    }
    default: return [{ x: 0, y: 0, width: W, height: H }];
  }
}

const DEFAULT_BUTTON: ButtonConfig = {
  label: "予約する",
  actionType: "reservation",
  value: "",
  bgColor: "#1ABC9C",
  textColor: "#FFFFFF",
};

export function RichMenuEditor({ channelId, initial }: { channelId: string; initial: Initial }) {
  const [size, setSize] = useState<"large" | "compact">(initial?.size ?? "large");
  const [layout, setLayout] = useState<"1" | "2" | "3" | "4" | "6">(initial?.layout ?? "2");
  const [chatBarText, setChatBarText] = useState(initial?.chatBarText ?? "メニュー");
  const [buttons, setButtons] = useState<ButtonConfig[]>(
    initial?.buttons ?? [
      { ...DEFAULT_BUTTON },
      { label: "電話する", actionType: "message", value: "電話で予約したいです", bgColor: "#16A085", textColor: "#FFFFFF" },
    ],
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bounds = layoutBounds(layout, size);

  // ボタン数をレイアウトに合わせる
  useEffect(() => {
    setButtons((prev) => {
      const need = bounds.length;
      if (prev.length === need) return prev;
      if (prev.length < need) {
        const add = Array.from({ length: need - prev.length }, () => ({ ...DEFAULT_BUTTON, label: "ボタン" }));
        return [...prev, ...add];
      }
      return prev.slice(0, need);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, size]);

  // Canvas 描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = SIZES[size];
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    bounds.forEach((b, i) => {
      const btn = buttons[i];
      if (!btn) return;
      // 背景
      ctx.fillStyle = btn.bgColor;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      // 枠線（白）
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 6;
      ctx.strokeRect(b.x + 3, b.y + 3, b.width - 6, b.height - 6);
      // ラベル
      ctx.fillStyle = btn.textColor;
      const fontSize = Math.min(b.width, b.height) * 0.16;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(btn.label, b.x + b.width / 2, b.y + b.height / 2, b.width * 0.9);
    });
  }, [size, layout, buttons, bounds]);

  function updateButton(i: number, patch: Partial<ButtonConfig>) {
    setButtons((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  function apply() {
    setError(null);
    setMsg(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const imageBase64 = canvas.toDataURL("image/png");
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/richmenu`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ size, layout, chatBarText, buttons, imageBase64 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "適用に失敗しました");
        return;
      }
      setMsg("リッチメニューを適用しました！LINE のトーク画面で確認してください。");
    });
  }

  function remove() {
    if (!confirm("リッチメニューを削除しますか？")) return;
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/richmenu`, { method: "DELETE" });
      if (res.ok) setMsg("リッチメニューを削除しました。");
    });
  }

  const previewScale = size === "large" ? 360 / 2500 : 360 / 2500;

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded">{error}</div>}
      {msg && <div className="bg-line-light border border-line text-line-dark text-sm p-3 rounded">{msg}</div>}

      <div className="bg-white border rounded p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">サイズ</label>
            <select value={size} onChange={(e) => setSize(e.target.value as "large" | "compact")} className="mt-1 w-full border rounded px-3 py-2 text-sm">
              <option value="large">大（2500×1686）</option>
              <option value="compact">小（2500×843）</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">ボタン配置</label>
            <select value={layout} onChange={(e) => setLayout(e.target.value as typeof layout)} className="mt-1 w-full border rounded px-3 py-2 text-sm">
              <option value="1">1 ボタン</option>
              <option value="2">2 ボタン（横並び）</option>
              <option value="3">3 ボタン（横並び）</option>
              <option value="4">4 ボタン（2×2）</option>
              <option value="6">6 ボタン（2×3）</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">メニューバーの文字</label>
            <input value={chatBarText} onChange={(e) => setChatBarText(e.target.value)} maxLength={14} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* プレビュー */}
        <div className="bg-white border rounded p-5">
          <h2 className="font-medium mb-3">プレビュー</h2>
          <div className="border rounded overflow-hidden inline-block">
            <canvas
              ref={canvasRef}
              style={{ width: 360, height: 360 * (SIZES[size].h / SIZES[size].w), display: "block" }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">この画像がそのまま LINE に登録されます。</p>
        </div>

        {/* ボタン設定 */}
        <div className="bg-white border rounded p-5 space-y-4">
          <h2 className="font-medium">ボタン設定</h2>
          {buttons.map((b, i) => (
            <div key={i} className="border rounded p-3 space-y-2">
              <div className="text-xs text-gray-500">ボタン {i + 1}</div>
              <input
                value={b.label}
                onChange={(e) => updateButton(i, { label: e.target.value })}
                placeholder="ボタンの文字"
                className="w-full border rounded px-2 py-1.5 text-sm"
              />
              <div className="flex gap-2">
                <select
                  value={b.actionType}
                  onChange={(e) => updateButton(i, { actionType: e.target.value as ActionType })}
                  className="border rounded px-2 py-1.5 text-sm flex-1"
                >
                  <option value="reservation">予約サイトを開く</option>
                  <option value="uri">URLを開く</option>
                  <option value="message">メッセージを送る</option>
                </select>
                <input type="color" value={b.bgColor} onChange={(e) => updateButton(i, { bgColor: e.target.value })} className="w-10 h-9 border rounded" title="背景色" />
                <input type="color" value={b.textColor} onChange={(e) => updateButton(i, { textColor: e.target.value })} className="w-10 h-9 border rounded" title="文字色" />
              </div>
              {b.actionType === "uri" && (
                <input value={b.value} onChange={(e) => updateButton(i, { value: e.target.value })} placeholder="https://..." className="w-full border rounded px-2 py-1.5 text-sm" />
              )}
              {b.actionType === "message" && (
                <input value={b.value} onChange={(e) => updateButton(i, { value: e.target.value })} placeholder="送信するメッセージ（空ならボタン文字）" className="w-full border rounded px-2 py-1.5 text-sm" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={apply} disabled={pending} className="bg-line text-white px-5 py-2.5 rounded text-sm font-medium disabled:opacity-50">
          {pending ? "適用中..." : "リッチメニューを適用"}
        </button>
        {initial?.isApplied && (
          <button onClick={remove} disabled={pending} className="border border-red-300 text-red-600 px-4 py-2.5 rounded text-sm disabled:opacity-50 ml-auto">
            削除
          </button>
        )}
      </div>
    </div>
  );
}
