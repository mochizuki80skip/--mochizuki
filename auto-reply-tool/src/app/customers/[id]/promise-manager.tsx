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
  notes: string | null;
  started_at: string | null;
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
  const [editingId, setEditingId] = useState<string | null>(null);

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
        started_at: new Date().toISOString().slice(0, 10),
      })
      .select("id, title, unit, target, is_active, notes, started_at")
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

  async function updatePromise(p: PromiseRow, patch: Partial<PromiseRow>) {
    const { error: updateError } = await supabase
      .from("promises")
      .update({
        notes: patch.notes ?? null,
        started_at: patch.started_at ?? null,
      })
      .eq("id", p.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPromises(promises.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    setEditingId(null);
  }

  return (
    <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100 space-y-4">
      <div>
        <h2 className="font-semibold">お約束</h2>
        <p className="text-xs text-gray-500 mt-1">
          歩数 5000 歩 / 水 2L など、日々の達成を見たい項目を登録します。
          背景メモは AI が返信生成時に参考にします。
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
              className={`border rounded px-3 py-2 ${
                p.is_active ? "border-brand-200" : "border-gray-200 opacity-60"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{p.title}</span>
                  {p.target !== null && (
                    <span className="ml-2 text-sm text-gray-600">
                      目標: {p.target}
                      {p.unit ?? ""}
                    </span>
                  )}
                  {p.started_at && (
                    <span className="ml-2 text-xs text-gray-500">
                      開始: {p.started_at}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 text-sm flex-shrink-0">
                  <button
                    onClick={() =>
                      setEditingId(editingId === p.id ? null : p.id)
                    }
                    className="text-brand-600 hover:underline"
                  >
                    {editingId === p.id ? "閉じる" : "メモ"}
                  </button>
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
              </div>
              {p.notes && editingId !== p.id && (
                <div className="text-xs text-gray-600 mt-1.5 border-l-2 border-brand-200 pl-2 whitespace-pre-wrap">
                  {p.notes}
                </div>
              )}
              {editingId === p.id && (
                <PromiseEditor
                  promise={p}
                  onSave={(patch) => updatePromise(p, patch)}
                  onCancel={() => setEditingId(null)}
                />
              )}
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

function PromiseEditor({
  promise,
  onSave,
  onCancel,
}: {
  promise: PromiseRow;
  onSave: (patch: { notes: string | null; started_at: string | null }) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState(promise.notes ?? "");
  const [startedAt, setStartedAt] = useState(promise.started_at ?? "");

  return (
    <div className="mt-2 space-y-2 bg-brand-50 rounded p-3">
      <label className="block">
        <span className="block text-xs text-gray-600 mb-1">
          開始日 (このお約束に取り組み始めた日)
        </span>
        <input
          type="date"
          value={startedAt}
          onChange={(e) => setStartedAt(e.target.value)}
          className="border rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block">
        <span className="block text-xs text-gray-600 mb-1">
          背景メモ (なぜこのお約束?お客様の事情など)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={"例:\n夜勤シフトで体重増。まず無理ない範囲で歩数から。\n本人は走るのが苦手なので、徒歩通勤で達成する作戦。"}
          className="w-full border rounded px-2 py-1.5 text-sm"
        />
      </label>
      <div className="flex gap-2">
        <button
          onClick={() =>
            onSave({
              notes: notes.trim() || null,
              started_at: startedAt || null,
            })
          }
          className="bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded text-sm"
        >
          保存
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-gray-600 hover:underline"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
