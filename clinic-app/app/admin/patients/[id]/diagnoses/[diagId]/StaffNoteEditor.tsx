"use client";

import { useState } from "react";

export default function StaffNoteEditor({
  diagnosisId,
  initial,
}: {
  diagnosisId: string;
  initial: string | null;
}) {
  const [note, setNote] = useState(initial || "");
  const [saved, setSaved] = useState<string>(initial || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = note !== saved;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/diagnoses/${diagnosisId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_note: note }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        if (typeof json?.error === "string" && /column .* staff_note/i.test(json.error)) {
          setError(
            "staff_note カラムがDBにありません。Supabase で alter table を実行してください。",
          );
        } else {
          setError("保存に失敗しました");
        }
        return;
      }
      setSaved(note);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs tracking-widest text-ink-400 font-bold">
          施術メモ（スタッフ専用）
        </h2>
        {dirty && (
          <span className="text-[10px] text-amber-600 tracking-widest">
            未保存
          </span>
        )}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
        placeholder="施術内容、観察、次回確認することなど"
        className="block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent leading-relaxed"
      />
      {error && (
        <div className="mt-2 rounded-lg bg-rose-50 text-rose-700 text-xs px-3 py-2 border border-rose-200">
          {error}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <p className="text-[10px] text-ink-400 leading-relaxed flex-1">
          このメモは患者画面には表示されません
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-full bg-accent text-ink-900 font-bold text-xs px-4 py-1.5 shadow-soft hover:bg-accent-400 transition disabled:bg-ink-100 disabled:text-ink-300"
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </section>
  );
}
