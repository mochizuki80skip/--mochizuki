"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Customer = {
  id: string;
  name: string;
  goal: string | null;
  tone_memo: string | null;
};

export type PromiseRow = {
  id: string;
  title: string;
  unit: string | null;
  target: number | null;
};

type Achievement = {
  promise_id: string;
  promise_title: string;
  status: "done" | "miss" | "skip";
  value: string;
  unit: string | null;
};

type Tone = "normal" | "encourage" | "praise";

const TONE_LABELS: Record<Tone, string> = {
  normal: "いつも通り",
  encourage: "少し背中を押す",
  praise: "しっかり褒める",
};

export function ReplyCreator({
  customer,
  promises,
}: {
  customer: Customer;
  promises: PromiseRow[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [achievements, setAchievements] = useState<Achievement[]>(
    promises.map((p) => ({
      promise_id: p.id,
      promise_title: p.title,
      status: "skip",
      value: "",
      unit: p.unit,
    }))
  );
  const [customerMsg, setCustomerMsg] = useState("");
  const [tone, setTone] = useState<Tone>("normal");

  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editedReply, setEditedReply] = useState("");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  function updateAchievement(idx: number, patch: Partial<Achievement>) {
    setAchievements((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setSuggestions([]);
    setSelectedIdx(null);

    const payload = {
      customerId: customer.id,
      achievements: achievements
        .filter((a) => a.status !== "skip")
        .map((a) => ({
          promiseTitle: a.promise_title,
          status: a.status as "done" | "miss",
          value: a.value ? Number(a.value) : undefined,
          unit: a.unit ?? undefined,
        })),
      customerMsg: customerMsg.trim() || undefined,
      tone,
    };

    try {
      const res = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || data.error || "生成に失敗しました");
        return;
      }
      setSuggestions(data.suggestions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }

  function pickSuggestion(idx: number) {
    setSelectedIdx(idx);
    setEditedReply(suggestions[idx]);
    setCopied(false);
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(editedReply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("クリップボードへのコピーに失敗しました");
    }
  }

  async function handleSave() {
    if (!editedReply.trim()) {
      setError("返信内容が空です");
      return;
    }
    setSaving(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("reports").insert({
      customer_id: customer.id,
      achievements: achievements
        .filter((a) => a.status !== "skip")
        .map((a) => ({
          promise_id: a.promise_id,
          title: a.promise_title,
          status: a.status,
          value: a.value ? Number(a.value) : null,
          unit: a.unit,
        })),
      customer_msg: customerMsg.trim() || null,
      staff_reply: editedReply.trim(),
      tone_used: tone,
      created_by: userData.user?.id ?? null,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    router.push(`/customers/${customer.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100">
        <h1 className="text-xl font-semibold">
          {customer.name} さんへの返信を作る
        </h1>
        {customer.goal && (
          <p className="text-sm text-gray-600 mt-1">目標: {customer.goal}</p>
        )}
        {customer.tone_memo && (
          <p className="text-xs text-gray-500 mt-1">
            距離感: {customer.tone_memo}
          </p>
        )}
      </section>

      <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100 space-y-4">
        <h2 className="font-semibold">今日のお約束</h2>
        {achievements.length === 0 ? (
          <p className="text-sm text-gray-500">
            このお客様にはまだ有効なお約束がありません。
            <a
              href={`/customers/${customer.id}`}
              className="text-brand-600 hover:underline ml-1"
            >
              詳細画面で追加
            </a>
          </p>
        ) : (
          <ul className="space-y-3">
            {achievements.map((a, idx) => (
              <li
                key={a.promise_id}
                className="border border-brand-100 rounded p-3"
              >
                <div className="font-medium mb-2">{a.promise_title}</div>
                <div className="flex flex-wrap gap-3 items-center">
                  <StatusToggle
                    value={a.status}
                    onChange={(s) => updateAchievement(idx, { status: s })}
                  />
                  {a.status !== "skip" && (
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-gray-500">数値:</span>
                      <input
                        type="number"
                        step="any"
                        value={a.value}
                        onChange={(e) =>
                          updateAchievement(idx, { value: e.target.value })
                        }
                        placeholder="任意"
                        className="border rounded px-2 py-1 w-24"
                      />
                      {a.unit && (
                        <span className="text-gray-500">{a.unit}</span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100 space-y-3">
        <h2 className="font-semibold">お客様のコメント(任意)</h2>
        <textarea
          value={customerMsg}
          onChange={(e) => setCustomerMsg(e.target.value)}
          rows={3}
          placeholder="例: 今日は仕事が忙しくて歩けませんでした…"
          className="w-full border rounded px-3 py-2"
        />
      </section>

      <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100 space-y-3">
        <h2 className="font-semibold">返信のトーン</h2>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTone(t)}
              className={`px-3 py-1.5 rounded-full text-sm border transition ${
                tone === t
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-gray-700 border-gray-300 hover:border-brand-500"
              }`}
            >
              {TONE_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      <button
        onClick={handleGenerate}
        disabled={generating}
        className="w-full bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60"
      >
        {generating ? "AI が考え中…" : "🪄 返信案を生成"}
      </button>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </p>
      )}

      {suggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">返信案(クリックで採用)</h2>
          <div className="grid gap-3">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => pickSuggestion(idx)}
                className={`text-left bg-white rounded-lg p-4 border-2 transition ${
                  selectedIdx === idx
                    ? "border-brand-500 ring-2 ring-brand-100"
                    : "border-brand-100 hover:border-brand-500"
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">案 {idx + 1}</div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {s}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {selectedIdx !== null && (
        <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-500 space-y-3 sticky bottom-2">
          <h2 className="font-semibold">採用した返信(編集してから保存)</h2>
          <textarea
            value={editedReply}
            onChange={(e) => setEditedReply(e.target.value)}
            rows={5}
            className="w-full border rounded px-3 py-2"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyToClipboard}
              className="border border-brand-500 text-brand-600 hover:bg-brand-50 px-4 py-2 rounded"
            >
              {copied ? "✓ コピーしました" : "📋 コピー"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded disabled:opacity-60"
            >
              {saving ? "保存中…" : "履歴に保存して終了"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function StatusToggle({
  value,
  onChange,
}: {
  value: Achievement["status"];
  onChange: (s: Achievement["status"]) => void;
}) {
  const options: { v: Achievement["status"]; label: string; cls: string }[] = [
    { v: "done", label: "達成", cls: "bg-green-500 text-white border-green-500" },
    { v: "miss", label: "未達", cls: "bg-orange-400 text-white border-orange-400" },
    { v: "skip", label: "入力なし", cls: "bg-gray-400 text-white border-gray-400" },
  ];
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`px-3 py-1 text-sm rounded border transition ${
            value === o.v
              ? o.cls
              : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
