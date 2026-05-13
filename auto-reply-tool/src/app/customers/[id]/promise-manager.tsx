"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type PromiseRow = {
  id: string;
  title: string;
  unit: string | null;
  target: number | null;
  is_active: boolean;
};

export function PromiseManager({
  customerId,
  initial,
}: {
  customerId: string;
  initial: PromiseRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [promises, setPromises] = useState<PromiseRow[]>(initial);
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    const { data, error: insertError } = await supabase
      .from("promises")
      .insert({
        customer_id: customerId,
        title: title.trim(),
        unit: unit.trim() || null,
        target: target ? Number(target) : null,
      })
      .select("id, title, unit, target, is_active")
      .single();
    setAdding(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setPromises([...promises, data as PromiseRow]);
    setTitle("");
    setUnit("");
    setTarget("");
    router.refresh();
  }

  async function toggleActive(p: PromiseRow) {
    const { error: updateError } = await supabase
      .from("promises")
      .update({ is_active: !p.is_active })
      .eq("id", p.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPromises(
      promises.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x))
    );
  }

  async function remove(p: PromiseRow) {
    if (!confirm(`「${p.title}」を削除しますか?`)) return;
    const { error: deleteError } = await supabase
      .from("promises")
      .delete()
      .eq("id", p.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setPromises(promises.filter((x) => x.id !== p.id));
  }

  return (
    <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100 space-y-4">
      <div>
        <h2 className="font-semibold">お約束</h2>
        <p className="text-xs text-gray-500 mt-1">
          歩数 5000 歩 / 水 2L など、日々の達成を見たい項目を登録します。
        </p>
      </div>

      {promises.length === 0 ? (
        <p className="text-sm text-gray-500">
          まだ登録がありません。下のフォームから追加してください。
        </p>
      ) : (
        <ul className="space-y-2">
          {promises.map((p) => (
            <li
              key={p.id}
              className={`flex items-center justify-between border rounded px-3 py-2 ${
                p.is_active ? "border-brand-200" : "border-gray-200 opacity-60"
              }`}
            >
              <div>
                <span className="font-medium">{p.title}</span>
                {p.target !== null && (
                  <span className="ml-2 text-sm text-gray-600">
                    目標: {p.target}
                    {p.unit ?? ""}
                  </span>
                )}
              </div>
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => toggleActive(p)}
                  className="text-brand-600 hover:underline"
                >
                  {p.is_active ? "停止" : "再開"}
                </button>
                <button
                  onClick={() => remove(p)}
                  className="text-red-600 hover:underline"
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={handleAdd}
        className="grid sm:grid-cols-[1fr_120px_120px_auto] gap-2 items-end pt-2 border-t border-brand-100"
      >
        <label className="block">
          <span className="block text-xs text-gray-600 mb-1">項目名</span>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 歩数"
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-gray-600 mb-1">目標値</span>
          <input
            type="number"
            step="any"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="5000"
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-gray-600 mb-1">単位</span>
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="歩 / L / 回"
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={adding}
          className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-2 rounded text-sm disabled:opacity-60"
        >
          {adding ? "追加中…" : "+ 追加"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
