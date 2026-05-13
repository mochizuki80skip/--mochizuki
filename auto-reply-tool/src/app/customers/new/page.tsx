"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function NewCustomerPage() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [toneMemo, setToneMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const { data, error: insertError } = await supabase
      .from("customers")
      .insert({
        name: name.trim(),
        goal: goal.trim() || null,
        tone_memo: toneMemo.trim() || null,
        staff_id: userData.user?.id ?? null,
      })
      .select("id")
      .single();

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.replace(`/customers/${data.id}`);
    router.refresh();
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-4">
        <Link href="/customers" className="text-sm text-brand-600 hover:underline">
          ← お客様一覧
        </Link>
      </div>
      <div className="bg-white rounded-lg p-6 shadow-sm border border-brand-100">
        <h1 className="text-lg font-semibold mb-4">新しいお客様</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="お名前 (必須)">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </Field>
          <Field label="目標">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              placeholder="例: 半年で 5kg 減量 / ヒップアップ"
              className="w-full border rounded px-3 py-2"
            />
          </Field>
          <Field label="距離感メモ">
            <textarea
              value={toneMemo}
              onChange={(e) => setToneMemo(e.target.value)}
              rows={2}
              placeholder="例: 丁寧め・絵文字少なめ / フランクOK"
              className="w-full border rounded px-3 py-2"
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
