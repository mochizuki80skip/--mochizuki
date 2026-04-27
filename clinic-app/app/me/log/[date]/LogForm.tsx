"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BODY_PARTS,
  BODY_PARTS_BY_CATEGORY,
  BODY_PART_CATEGORY_LABEL,
  CATEGORY_LABEL,
  MOOD_OPTIONS,
  SLEEP_HOURS_OPTIONS,
  SYMPTOMS_BY_CATEGORY,
  bodyPartHasSide,
  formatSleepHours,
  type BodyPartCategory,
  type PainSide,
} from "@/lib/symptoms";
import type { DailyLog, PainRecord } from "@/lib/types";

const PART_CATS: BodyPartCategory[] = ["upper", "trunk", "lower", "other"];

type PainState = Record<
  string,
  { side: PainSide | null; strength: number; free_text?: string }
>;

function painsToState(pains: PainRecord[] | null | undefined): PainState {
  const out: PainState = {};
  for (const p of pains || []) {
    out[p.area] = {
      side: p.side,
      strength: p.strength,
      free_text: p.free_text || "",
    };
  }
  return out;
}

function stateToPains(state: PainState): PainRecord[] {
  return Object.entries(state).map(([area, v]) => ({
    area,
    side: v.side,
    strength: v.strength,
    free_text: area === "other" ? v.free_text || null : null,
  }));
}

export default function LogForm({
  date,
  initial,
}: {
  date: string;
  initial: DailyLog | null;
}) {
  const router = useRouter();
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [sleepHours, setSleepHours] = useState<number | null>(
    initial?.sleep_hours ?? null,
  );
  const [bpHi, setBpHi] = useState<string>(
    initial?.bp_systolic != null ? String(initial.bp_systolic) : "",
  );
  const [bpLo, setBpLo] = useState<string>(
    initial?.bp_diastolic != null ? String(initial.bp_diastolic) : "",
  );
  const [pains, setPains] = useState<PainState>(painsToState(initial?.pains));
  const [symptoms, setSymptoms] = useState<Set<string>>(
    new Set(initial?.symptoms || []),
  );
  const [notes, setNotes] = useState<string>(initial?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  function togglePart(key: string) {
    setPains((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = {
          side: bodyPartHasSide(key) ? null : null,
          strength: 3,
        };
      }
      return next;
    });
  }
  function setPartSide(key: string, side: PainSide | null) {
    setPains((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { strength: 3 }), side },
    }));
  }
  function setPartStrength(key: string, strength: number) {
    setPains((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { side: null }), strength },
    }));
  }
  function setPartFreeText(key: string, free_text: string) {
    setPains((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || { side: null, strength: 3 }), free_text },
    }));
  }

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
      const bpHiN = bpHi.trim() ? parseInt(bpHi, 10) : null;
      const bpLoN = bpLo.trim() ? parseInt(bpLo, 10) : null;
      const res = await fetch(`/api/me/logs/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mood,
          sleep_hours: sleepHours,
          bp_systolic: Number.isFinite(bpHiN) ? bpHiN : null,
          bp_diastolic: Number.isFinite(bpLoN) ? bpLoN : null,
          symptoms: Array.from(symptoms),
          pains: stateToPains(pains),
          notes,
        }),
      });
      if (!res.ok) {
        setError("保存に失敗しました");
        return;
      }
      const json = await res.json().catch(() => ({}));
      setSavedNotice(json?.deleted ? "記録をクリアしました" : "保存しました");
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
          本日の調子
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

      {/* Pain */}
      <section>
        <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-3">
          痛み (タップで選択 → 部位ごとに左右と強さ)
        </h2>
        <div className="space-y-3">
          {PART_CATS.map((c) => {
            const items = BODY_PARTS_BY_CATEGORY[c];
            if (!items.length) return null;
            return (
              <div key={c}>
                <div className="text-[10px] tracking-widest text-ink-400 mb-1.5">
                  {BODY_PART_CATEGORY_LABEL[c]}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((b) => {
                    const selected = !!pains[b.key];
                    return (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => togglePart(b.key)}
                        className={[
                          "rounded-full px-3 py-1.5 text-sm font-bold transition active:scale-[0.97]",
                          selected
                            ? "bg-accent text-ink-900 shadow-soft"
                            : "bg-ink-50 text-ink-700 border border-ink-100 hover:border-accent",
                        ].join(" ")}
                        aria-pressed={selected}
                      >
                        {selected && <span className="mr-1">✓</span>}
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected parts: side + strength editor */}
        {Object.keys(pains).length > 0 && (
          <div className="mt-4 space-y-3">
            {BODY_PARTS.filter((b) => pains[b.key]).map((b) => {
              const p = pains[b.key];
              const showSide = bodyPartHasSide(b.key);
              return (
                <div
                  key={b.key}
                  className="rounded-xl border border-ink-100 bg-white p-3 shadow-soft"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-ink-900">
                      {b.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePart(b.key)}
                      className="text-[11px] text-ink-400 hover:text-rose-600"
                    >
                      削除
                    </button>
                  </div>
                  {b.freeText && (
                    <input
                      type="text"
                      value={p.free_text || ""}
                      onChange={(e) => setPartFreeText(b.key, e.target.value)}
                      placeholder="例: 右の親指のつけ根"
                      maxLength={200}
                      className="block w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent mb-2"
                    />
                  )}
                  {showSide && (
                    <div className="flex gap-1.5 mb-2">
                      {(
                        [
                          ["left", "左"],
                          ["right", "右"],
                          ["both", "両方"],
                        ] as const
                      ).map(([k, label]) => {
                        const sel = p.side === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() =>
                              setPartSide(b.key, sel ? null : (k as PainSide))
                            }
                            className={[
                              "flex-1 rounded-full py-1.5 text-xs font-bold transition",
                              sel
                                ? "bg-ink-900 text-white"
                                : "bg-ink-50 text-ink-700 border border-ink-200",
                            ].join(" ")}
                            aria-pressed={sel}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] tracking-widest text-ink-400 mb-1">
                      強さ ({p.strength}/5)
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 3, 4, 5].map((n) => {
                        const sel = p.strength === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setPartStrength(b.key, n)}
                            className={[
                              "rounded-lg py-1.5 text-xs font-bold transition tabular-nums",
                              sel
                                ? "bg-rose-500 text-white"
                                : "bg-rose-50 text-rose-700 border border-rose-200",
                            ].join(" ")}
                            aria-pressed={sel}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[10px] text-ink-400 mt-1">
                      <span>軽い</span>
                      <span>強い</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Symptoms (neuro/autonomic) */}
      <section>
        <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-3">
          {CATEGORY_LABEL.nerve_auto}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {SYMPTOMS_BY_CATEGORY.nerve_auto.map((s) => {
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
      </section>

      {/* Sleep hours: scrollable select (iOS shows native wheel picker) */}
      <section>
        <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-2">
          睡眠時間（任意）
        </h2>
        <select
          value={sleepHours == null ? "" : String(sleepHours)}
          onChange={(e) =>
            setSleepHours(e.target.value === "" ? null : parseFloat(e.target.value))
          }
          className="block w-full rounded-xl border border-ink-200 bg-white px-3 py-3 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="">未記入</option>
          {SLEEP_HOURS_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {formatSleepHours(h)}
            </option>
          ))}
        </select>
      </section>

      {/* Blood pressure */}
      <section>
        <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-2">
          血圧（任意）
        </h2>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label
              htmlFor="bp_hi"
              className="text-[10px] tracking-widest text-ink-400"
            >
              最高
            </label>
            <input
              id="bp_hi"
              type="number"
              inputMode="numeric"
              min={30}
              max={260}
              value={bpHi}
              onChange={(e) => setBpHi(e.target.value)}
              placeholder="120"
              className="block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent tabular-nums"
            />
          </div>
          <span className="pb-3 text-ink-400 font-bold">/</span>
          <div className="flex-1">
            <label
              htmlFor="bp_lo"
              className="text-[10px] tracking-widest text-ink-400"
            >
              最低
            </label>
            <input
              id="bp_lo"
              type="number"
              inputMode="numeric"
              min={30}
              max={260}
              value={bpLo}
              onChange={(e) => setBpLo(e.target.value)}
              placeholder="80"
              className="block w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent tabular-nums"
            />
          </div>
          <span className="pb-3 text-ink-400 text-xs">mmHg</span>
        </div>
      </section>

      {/* Notes */}
      <section>
        <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-2">
          一言メモ（任意）
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

