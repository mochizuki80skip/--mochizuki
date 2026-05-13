"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Trainer = {
  id: string;
  display_name: string;
  personality_memo: string | null;
  characteristic_phrases: string | null;
  signature_emoji: string | null;
};

export function TrainerProfileForm({
  userId,
  userEmail,
  initial,
}: {
  userId: string;
  userEmail: string;
  initial: Trainer | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState(
    initial?.display_name ?? userEmail.split("@")[0] ?? ""
  );
  const [personalityMemo, setPersonalityMemo] = useState(
    initial?.personality_memo ?? ""
  );
  const [phrases, setPhrases] = useState(
    initial?.characteristic_phrases ?? ""
  );
  const [emoji, setEmoji] = useState(initial?.signature_emoji ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    if (!displayName.trim()) {
      setError("表示名は必須です");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);

    const { error: upsertError } = await supabase.from("trainers").upsert({
      id: userId,
      display_name: displayName.trim(),
      personality_memo: personalityMemo.trim() || null,
      characteristic_phrases: phrases.trim() || null,
      signature_emoji: emoji.trim() || null,
    });

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-lg p-5 shadow-sm border border-brand-100 space-y-4">
      <Field
        label="表示名 (必須)"
        hint="返信に署名するわけではなく、AI への自己紹介に使われます"
      >
        <input
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="例: 谷口トレーナー"
          className="w-full border rounded px-3 py-2"
        />
      </Field>

      <Field
        label="個性メモ"
        hint="性格・スタンス・距離感の取り方。短文でOK"
      >
        <textarea
          value={personalityMemo}
          onChange={(e) => setPersonalityMemo(e.target.value)}
          rows={3}
          placeholder={"例:\n優しいけど甘やかさない。\n短文で締めるのが好み。\n体育会系より理詰めで励ますタイプ。"}
          className="w-full border rounded px-3 py-2 text-sm leading-relaxed"
        />
      </Field>

      <Field
        label="よく使う言い回し"
        hint="改行区切りで複数 OK。AI がここから語彙を借りてきます"
      >
        <textarea
          value={phrases}
          onChange={(e) => setPhrases(e.target.value)}
          rows={3}
          placeholder={"例:\nお見事です\nナイス継続\n無理なくいきましょう"}
          className="w-full border rounded px-3 py-2 text-sm leading-relaxed"
        />
      </Field>

      <Field
        label="よく使う絵文字"
        hint="スペース区切りで複数 OK"
      >
        <input
          type="text"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="例: 💪 ✨ 🍵 🌱"
          className="w-full border rounded px-3 py-2 text-lg"
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && (
        <p className="text-sm text-green-700">✓ 保存しました</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2 rounded disabled:opacity-60"
      >
        {saving ? "保存中…" : "保存"}
      </button>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-800">{label}</span>
      {hint && (
        <span className="block text-xs text-gray-500 mt-0.5 mb-1.5">
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}
