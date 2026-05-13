"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  name: string;
  goal: string | null;
  tone_memo: string | null;
  notes: string | null;
};

export function CustomerEditor({ customer }: { customer: Customer }) {
  const router = useRouter();
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [goal, setGoal] = useState(customer.goal ?? "");
  const [toneMemo, setToneMemo] = useState(customer.tone_memo ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("customers")
      .update({
        name: name.trim(),
        goal: goal.trim() || null,
        tone_memo: toneMemo.trim() || null,
        notes: notes.trim() || null,
      })
      .eq("id", customer.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`「${customer.name}」を削除しますか?`)) return;
    setSaving(true);
    const { error: deleteError } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.replace("/customers");
    router.refresh();
  }

  if (!editing) {
    return (
      <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">{customer.name}</h1>
            {customer.goal && (
              <p className="text-sm text-gray-700 mt-1">目標: {customer.goal}</p>
            )}
            {customer.tone_memo && (
              <p className="text-sm text-gray-500 mt-1">
                距離感: {customer.tone_memo}
              </p>
            )}
            {customer.notes && (
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap border-l-2 border-brand-200 pl-3">
                {customer.notes}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-sm border border-brand-500 text-brand-600 hover:bg-brand-50 px-3 py-1 rounded"
            >
              編集
            </button>
            <button
              onClick={handleDelete}
              disabled={saving}
              className="text-sm border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1 rounded disabled:opacity-60"
            >
              削除
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100 space-y-3">
      <h1 className="text-lg font-semibold">プロフィール編集</h1>
      <label className="block">
        <span className="block text-sm text-gray-600 mb-1">お名前</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="block text-sm text-gray-600 mb-1">目標</span>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={2}
          className="w-full border rounded px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="block text-sm text-gray-600 mb-1">距離感メモ</span>
        <textarea
          value={toneMemo}
          onChange={(e) => setToneMemo(e.target.value)}
          rows={2}
          placeholder="例: 丁寧め・絵文字少なめ"
          className="w-full border rounded px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="block text-sm text-gray-600 mb-1">
          背景ノート
          <span className="ml-2 text-xs text-gray-500">
            生活・体調・配慮事項など。AI が返信時に考慮します
          </span>
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder={"例:\n平日は接客業で立ち仕事。膝痛履歴あり。\n甘いものは制限中。週末は家族時間を大事にしたい。"}
          className="w-full border rounded px-3 py-2 text-sm leading-relaxed"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {saving ? "保存中…" : "保存"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setName(customer.name);
            setGoal(customer.goal ?? "");
            setToneMemo(customer.tone_memo ?? "");
            setNotes(customer.notes ?? "");
          }}
          className="text-gray-600 hover:underline"
        >
          キャンセル
        </button>
      </div>
    </section>
  );
}
