"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EditableField } from "@/lib/stores";
import { bulkUpdateStoresAction, importCsvAction } from "../../actions";

type Row = { id: string; isActive: boolean; fields: Record<EditableField, string>; vars: Record<string, string> };

const COLS: { key: EditableField; label: string; w: string; placeholder: boolean }[] = [
  { key: "name", label: "院名", w: "w-48", placeholder: true },
  { key: "city", label: "地名", w: "w-32", placeholder: true },
  { key: "area", label: "エリア", w: "w-40", placeholder: true },
  { key: "features", label: "特徴", w: "w-56", placeholder: true },
  { key: "bookingUrl", label: "予約URL", w: "w-56", placeholder: true },
  { key: "igHashtags", label: "Instagram ハッシュタグ", w: "w-48", placeholder: false },
];

export function StoreGrid({ initial, initialKeys }: { initial: Row[]; initialKeys: string[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [keys, setKeys] = useState(initialKeys);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const set = (i: number, patch: (r: Row) => Row) => {
    setRows((rs) => rs.map((r, j) => (j === i ? patch(r) : r)));
    setDirty(true);
  };

  function addColumn() {
    const k = prompt("追加する項目名（例：駐車場、院長名、最寄り駅）")?.trim();
    if (!k) return;
    if (/[{}｛｝\s]/.test(k)) return alert("項目名に空白や { } は使えません");
    if (!keys.includes(k)) setKeys([...keys, k]);
  }

  function removeColumn(k: string) {
    if (!confirm(`「${k}」列を全店舗から削除しますか？（保存するまで確定しません）`)) return;
    setKeys(keys.filter((x) => x !== k));
    setRows((rs) => rs.map((r) => {
      const { [k]: _, ...vars } = r.vars;
      return { ...r, vars };
    }));
    setDirty(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          disabled={!dirty || busy}
          onClick={() =>
            start(async () => {
              const n = await bulkUpdateStoresAction(
                rows.map((r) => ({ id: r.id, fields: r.fields, vars: Object.fromEntries(keys.map((k) => [k, r.vars[k] ?? ""])) })),
              );
              setDirty(false);
              setMsg(`${n} 店舗を保存しました`);
              router.refresh();
            })
          }
          className="bg-brand text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
        >
          保存
        </button>
        <button onClick={addColumn} className="border px-3 py-1.5 rounded text-sm bg-white">列を追加</button>
        <a href="/api/stores/csv" className="border px-3 py-1.5 rounded text-sm bg-white">CSV を書き出す</a>
        <label className="border px-3 py-1.5 rounded text-sm bg-white cursor-pointer">
          CSV を取り込む
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (dirty && !confirm("保存していない変更は破棄されます。取り込みますか？")) return;
              const fd = new FormData();
              fd.set("file", f);
              start(async () => {
                try {
                  const r = await importCsvAction(fd);
                  setMsg(`${r.updated} 店舗を更新しました${r.notFound.length ? `。見つからなかった行：${r.notFound.join("、")}` : ""}`);
                  router.refresh();
                  location.reload();
                } catch (err) {
                  setMsg(err instanceof Error ? err.message : "取り込みに失敗しました");
                }
              });
            }}
          />
        </label>
        {dirty && <span className="text-xs text-amber-700">未保存の変更があります</span>}
        {msg && <span className="text-xs text-gray-600">{msg}</span>}
      </div>

      <div className="bg-white border rounded overflow-auto max-h-[70vh]">
        <table className="text-sm border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-2 text-left font-medium whitespace-nowrap border-b">{c.placeholder ? `{${c.label}}` : c.label}</th>
              ))}
              {keys.map((k) => (
                <th key={k} className="px-2 py-2 text-left font-medium whitespace-nowrap border-b">
                  {`{${k}}`}
                  <button onClick={() => removeColumn(k)} className="ml-1 text-gray-400 hover:text-red-600" title="列を削除">×</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={`border-t ${r.isActive ? "" : "opacity-50"}`}>
                {COLS.map((c) => (
                  <td key={c.key} className="p-0.5">
                    <input
                      value={r.fields[c.key]}
                      onChange={(e) => set(i, (x) => ({ ...x, fields: { ...x.fields, [c.key]: e.target.value } }))}
                      className={`${c.w} border rounded px-2 py-1 ${c.placeholder && !r.fields[c.key] ? "bg-amber-50" : ""}`}
                    />
                  </td>
                ))}
                {keys.map((k) => (
                  <td key={k} className="p-0.5">
                    <input
                      value={r.vars[k] ?? ""}
                      onChange={(e) => set(i, (x) => ({ ...x, vars: { ...x.vars, [k]: e.target.value } }))}
                      className={`w-40 border rounded px-2 py-1 ${!r.vars[k] ? "bg-amber-50" : ""}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">黄色は空欄です。テンプレートで使う項目が空欄の店舗は「要修正」になり承認できません。</p>
    </div>
  );
}
