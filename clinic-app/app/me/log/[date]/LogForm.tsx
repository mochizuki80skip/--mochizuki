"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORY_LABEL,
  MOOD_OPTIONS,
  SYMPTOMS_BY_CATEGORY,
  type SymptomCategory,
} from "@/lib/symptoms";
import type { DailyLog } from "@/lib/types";

const CATEGORIES: SymptomCategory[] = [
  "pain",
  "nerve",
  "circ",
  "metab",
  "other",
];

export default function LogForm({
  date,
  initial,
}: {
  date: string;
  initial: DailyLog | null;
}) {
  const router = useRouter();
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [sleep, setSleep] = useState<number | null>(
    initial?.sleep_quality ?? null,
  );
  const [symptoms, setSymptoms] = useState<Set<string>>(
    new Set(initial?.symptoms || []),
  );
  const [notes, setNotes] = useState<string>(initial?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  function toggleSymptom(key: string) {
    setSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    setError(null);
    setSavedNotice(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/me/logs/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          sleep_quality: sleep,
          symptoms: Array.from(symptoms),
          notes,
        }),
      });
      if (!res.ok) {
        setError("保存に失敗しました");
        return;
      }
      const json = await res.json().catch(() => ({}));
      setSavedNotice(json?.deleted ? "記録をクリアしました" : "保存しました");
      // Refresh so calendar dots update if we navigate back.
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Mood */}
      <section>
        <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-3">
          今日の気分
        </h2>
        <div className="grid grid-cols-5 gap-1.5">
          {MOOD_OPTIONS.map((m) => {
            const selected = mood === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMood(selected ? null : m.value)}
                className={[
                  "rounded-xl py-2.5 px-1 text-center transition active:scale-[0.97]",
                  selected
                    ? "bg-accent text-ink-900 shadow-soft"
                    : "bg-white border border-ink-200 text-ink-700 hover:border-accent",
                ].join(" ")}
                aria-pressed={selected}
              >
                <div className="text-2xl leading-none">{m.emoji}</div>
                <div className="text-[10px] mt-1 font-bold">{m.label}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Sleep */}
      <section>
        <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-3">
          睡眠の質
        </h2>
        <div className="grid grid-cols-5 gap-1.5">
          {MOOD_OPTIONS.map((m) => {
            const selected = sleep === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setSleep(selected ? null : m.value)}
                className={[
                  "rounded-xl py-2 px-1 text-center transition active:scale-[0.97]",
                  selected
                    ? "bg-ink-900 text-white shadow-soft"
                    : "bg-white border border-ink-200 text-ink-700 hover:border-ink-900",
                ].join(" ")}
                aria-pressed={selected}
              >
                <div className="text-[11px] font-bold tabular-nums">
                  {m.value}
                </div>
                <div className="text-[10px] mt-0.5">{m.label}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Symptoms */}
      <section>
        <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-3">
          今日感じた不調 (タップで複数選択)
        </h2>
        <div className="space-y-3">
          {CATEGORIES.map((c) => {
            const items = SYMPTOMS_BY_CATEGORY[c];
            if (!items.length) return null;
            return (
              <div key={c}>
                <div className="text-[10px] tracking-widest text-ink-400 mb-1.5">
                  {CATEGORY_LABEL[c]}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((s) => {
                    const selected = symptoms.has(s.key);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => toggleSymptom(s.key)}
                        className={[
                          "rounded-full px-3 py-1.5 text-sm font-bold transition active:scale-[0.97]",
                          selected
                            ? "bg-accent text-ink-900 shadow-soft"
                            : "bg-ink-50 text-ink-700 border border-ink-100 hover:border-accent",
                        ].join(" ")}
                        aria-pressed={selected}
                      >
                        {selected && <span className="mr-1">✓</span>}
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Notes */}
      <section>
        <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-2">
          今日のひとこと（任意）
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="例: ストレッチで腰痛が和らいだ"
          className="block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent leading-relaxed"
        />
        <div className="text-[10px] text-ink-400 text-right mt-1 tabular-nums">
          {notes.length} / 2000
        </div>
      </section>

      {error && (
        <div className="rounded-lg bg-rose-50 text-rose-700 text-sm px-3 py-2 border border-rose-200">
          {error}
        </div>
      )}
      {savedNotice && (
        <div className="rounded-lg bg-emerald-50 text-emerald-700 text-sm px-3 py-2 border border-emerald-200">
          {savedNotice}
        </div>
      )}

      <div className="sticky bottom-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="block w-full text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition disabled:bg-ink-100 disabled:text-ink-300"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </div>
  );
}
