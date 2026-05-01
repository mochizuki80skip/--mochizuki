"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LIKERT_OPTIONS, QUESTIONS } from "@/lib/questions";
import { computeResult } from "@/lib/scoring";
import { saveAnswers, saveResult, setPatientContext } from "@/lib/storage";
import { AXIS_LABEL, BENSHO_LABEL } from "@/lib/types";
import type { Answer } from "@/lib/types";
import ProgressBar from "@/components/ProgressBar";

export default function DiagnoseClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  // ?patient=<id> sets the patient context for this diagnosis session.
  useEffect(() => {
    const pid = searchParams.get("patient");
    if (pid) setPatientContext(pid);
  }, [searchParams]);
  const total = QUESTIONS.length;
  const q = QUESTIONS[idx];
  const current = answers[q.id];

  // keyboard support: 1-4 for direct select (mapped to value 0-3), ←→ for nav
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["1", "2", "3", "4"].includes(e.key)) {
        setAnswer(parseInt(e.key, 10) - 1);
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, answers]);

  function setAnswer(v: number) {
    setAnswers((prev) => ({ ...prev, [q.id]: v }));
  }

  function goPrev() {
    if (idx > 0) setIdx(idx - 1);
  }
  function goNext() {
    if (current == null) return;
    if (idx < total - 1) {
      setIdx(idx + 1);
    } else {
      finalize();
    }
  }

  function finalize() {
    const list: Answer[] = QUESTIONS.map((q) => ({
      id: q.id,
      value: answers[q.id] ?? 0,
    }));
    saveAnswers(list);
    const result = computeResult(list);
    saveResult(result);
    router.push("/result");
  }

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-10 min-h-screen flex flex-col">
      {/* Top */}
      <div className="flex items-center gap-2 mb-5">
        <button
          aria-label="戻る"
          onClick={() => (idx === 0 ? router.push("/") : goPrev())}
          className="text-ink-500 hover:text-ink-900 text-sm tracking-widest"
        >
          ← {idx === 0 ? "TOP" : "BACK"}
        </button>
        <span className="ml-auto text-[10px] tracking-[0.2em] text-ink-400">
          DIAGNOSE
        </span>
      </div>

      <ProgressBar current={idx + 1} total={total} />

      {/* Question */}
      <div key={q.id} className="mt-8 fade-up">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-widest bg-accent-100 text-accent-600">
            {AXIS_LABEL[q.axis].ja} / {BENSHO_LABEL[q.bensho].ja}
          </span>
          <span className="text-[11px] tracking-widest text-ink-400">
            Q{idx + 1}.
          </span>
        </div>
        <h2 className="text-[20px] leading-[1.55] font-bold text-ink-900">
          {q.text}
        </h2>
        {q.hint && (
          <p className="text-xs text-ink-400 mt-2 leading-relaxed">{q.hint}</p>
        )}
      </div>

      {/* Likert options (0-3 frequency) */}
      <fieldset className="mt-8 grid grid-cols-1 gap-2.5">
        <legend className="sr-only">回答を選択</legend>
        {LIKERT_OPTIONS.map((opt, i) => {
          const selected = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAnswer(opt.value)}
              className={[
                "flex items-center justify-between rounded-xl border px-4 py-3.5 text-sm font-bold transition active:scale-[0.99]",
                selected
                  ? "border-accent bg-accent-50 text-ink-900 shadow-glow"
                  : "border-ink-100 bg-white text-ink-700 hover:border-ink-200",
              ].join(" ")}
              aria-pressed={selected}
            >
              <span className="flex items-center gap-3">
                <span
                  className={[
                    "inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black tabular-nums",
                    selected
                      ? "bg-accent text-ink-900"
                      : "bg-ink-100 text-ink-500",
                  ].join(" ")}
                >
                  {i + 1}
                </span>
                {opt.label}
              </span>
              {selected && (
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4.5 4.5L19 7" stroke="#0F1115" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </fieldset>

      <div className="mt-auto pt-8">
        <div className="flex gap-3">
          <button
            onClick={goPrev}
            disabled={idx === 0}
            className="flex-1 rounded-full border border-ink-200 text-ink-700 font-bold py-3.5 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            前へ
          </button>
          <button
            onClick={goNext}
            disabled={current == null}
            className="flex-[2] rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 disabled:bg-ink-100 disabled:text-ink-300 disabled:cursor-not-allowed shadow-soft active:scale-[0.99]"
          >
            {idx === total - 1 ? "結果を見る" : "次へ"}
          </button>
        </div>
        <p className="text-center text-[11px] text-ink-400 mt-3">
          数字キー 1-4 / 矢印キーでも操作できます
        </p>
      </div>
    </main>
  );
}
