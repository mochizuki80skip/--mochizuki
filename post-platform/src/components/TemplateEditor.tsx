"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { fillTemplate, STANDARD_FIELDS, type TemplateStore } from "@/lib/template";

export type PreviewStore = TemplateStore & { id: string };

// テンプレート入力欄。{院名} などのボタンでカーソル位置に差し込み項目を入れ、店舗を選んで仕上がりを確認できる
export function TemplateEditor({
  stores,
  customKeys,
  defaultGbp = "",
  defaultIg = "",
}: {
  stores: PreviewStore[];
  customKeys: string[];
  defaultGbp?: string;
  defaultIg?: string;
}) {
  const [gbp, setGbp] = useState(defaultGbp);
  const [ig, setIg] = useState(defaultIg);
  const [active, setActive] = useState<"gbp" | "ig">("gbp");
  const [previewId, setPreviewId] = useState(stores[0]?.id ?? "");
  const refs = { gbp: useRef<HTMLTextAreaElement>(null), ig: useRef<HTMLTextAreaElement>(null) };
  const cursor = useRef<{ field: "gbp" | "ig"; pos: number } | null>(null);

  // 差し込み後、React が値を更新してからカーソルを差し込んだ直後に戻す
  useLayoutEffect(() => {
    const c = cursor.current;
    if (!c) return;
    cursor.current = null;
    const el = refs[c.field].current;
    el?.focus();
    el?.setSelectionRange(c.pos, c.pos);
  });

  function insert(key: string) {
    const el = refs[active].current;
    const set = active === "gbp" ? setGbp : setIg;
    const token = `{${key}}`;
    if (!el) return set((v) => v + token);
    const { selectionStart: a, selectionEnd: b, value } = el;
    cursor.current = { field: active, pos: a + token.length };
    set(value.slice(0, a) + token + value.slice(b));
  }

  const store = stores.find((s) => s.id === previewId);
  const preview = (tpl: string) => (store ? fillTemplate(tpl, store) : null);
  const incomplete = stores.filter((s) => fillTemplate(`${gbp}\n${ig}`, s).missing.length > 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 items-center text-xs">
        <span className="text-gray-500 mr-1">差し込み：</span>
        {[...STANDARD_FIELDS.map((f) => f.key), ...customKeys].map((k) => (
          <button
            key={k}
            type="button"
            // ボタンを押しても入力欄のフォーカス（カーソル位置）を保つ
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(k)} className="px-2 py-0.5 rounded border bg-brand-light text-brand-dark">
            {`{${k}}`}
          </button>
        ))}
      </div>
      <label className="block text-sm font-medium">
        GBP 用テンプレート
        <textarea
          ref={refs.gbp}
          name="gbpTemplate"
          value={gbp}
          onChange={(e) => setGbp(e.target.value)}
          onFocus={() => setActive("gbp")}
          rows={8}
          placeholder={"【{エリア}の接骨院】\n{地名}の{院名}です。朝晩の冷え込みで…"}
          className="mt-1 w-full border rounded px-3 py-2 text-sm font-normal"
        />
      </label>
      <label className="block text-sm font-medium">
        Instagram 用テンプレート（空欄なら GBP 用＋ハッシュタグ）
        <textarea
          ref={refs.ig}
          name="igTemplate"
          value={ig}
          onChange={(e) => setIg(e.target.value)}
          onFocus={() => setActive("ig")}
          rows={6}
          className="mt-1 w-full border rounded px-3 py-2 text-sm font-normal"
        />
      </label>

      {stores.length > 0 && (
        <div className="border rounded p-3 bg-gray-50 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">仕上がり確認</span>
            <select value={previewId} onChange={(e) => setPreviewId(e.target.value)} className="border rounded px-2 py-1 text-sm">
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {preview(gbp) && <pre className="whitespace-pre-wrap text-sm bg-white border rounded p-2 font-sans">{preview(gbp)!.text || "（未入力）"}</pre>}
          {incomplete.length > 0 && (
            <div className="text-xs text-red-600">
              店舗リストに値がない店舗があります：
              {incomplete.map((s) => `${s.name}（${fillTemplate(`${gbp}\n${ig}`, s).missing.join("・")}）`).join("、")}
              。店舗リストで入力するか、この店舗は承認時に「要修正」になります。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
