"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RadarChart from "@/components/RadarChart";
import AxisBar from "@/components/AxisBar";
import { contentForType, AXIS_DESC } from "@/lib/content";
import {
  loadResult,
  clearDiagnose,
  loadAnswers,
  getPatientContext,
  markResultSaved,
  isResultSaved,
} from "@/lib/storage";
import { constitutionScore } from "@/lib/scoring";
import { AXIS_LABEL, type DiagnoseResult } from "@/lib/types";

export default function ResultPage() {
  const router = useRouter();
  const [result, setResult] = useState<DiagnoseResult | null>(null);
  const [tab, setTab] = useState<"summary" | "advice">("summary");
  const [patientId, setPatientId] = useState<string | null>(null);
  // Who performed the diagnosis. Determines where the bottom CTA goes:
  //   "patient" → 自分のマイページ (cookie auth, no re-login needed)
  //   "admin"   → スタッフのお客様管理画面
  //   null      → 匿名トライアル
  const [role, setRole] = useState<"patient" | "admin" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "skipped" | "error">("idle");

  useEffect(() => {
    const r = loadResult();
    if (!r) {
      router.replace("/");
      return;
    }
    setResult(r);
    setPatientId(getPatientContext());

    // Save to DB once per result (server validates auth and decides whether to
    // actually persist or no-op for anonymous trials).
    if (isResultSaved()) {
      setSaveState("saved");
      return;
    }

    const answers = loadAnswers();
    setSaveState("saving");
    fetch("/api/diagnoses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Persist 3 大分類 axes plus the new 6-弁証 + treatment data so the
        // staff view can read them back. Old rows simply don't have these.
        scores: { ...r.axes, bensho: r.bensho, treatment: r.treatment },
        type_key: r.type,
        answers: answers || [],
        patient_id: getPatientContext(),
      }),
    })
      .then((res) => res.json().catch(() => ({})))
      .then((json) => {
        if (json?.role === "patient" || json?.role === "admin") {
          setRole(json.role);
        }
        if (typeof json?.patient_id === "string") {
          setPatientId(json.patient_id);
        }
        if (json?.saved) {
          markResultSaved();
          setSaveState("saved");
        } else {
          setSaveState("skipped");
        }
      })
      .catch(() => setSaveState("error"));
  }, [router]);

  if (!result) {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center text-ink-400">
        読み込み中...
      </main>
    );
  }

  const content = contentForType(result.type);
  const axisOrder = (["nerve", "circ", "metab"] as const).slice();

  const primary =
    result.primary && result.secondary
      ? `${AXIS_LABEL[result.primary].ja} × ${AXIS_LABEL[result.secondary].ja}`
      : result.primary
      ? AXIS_LABEL[result.primary].ja
      : null;

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12 fade-up">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href={patientId ? "/me/dashboard" : "/"}
          className="text-ink-500 hover:text-ink-900 text-sm tracking-widest"
        >
          ← {patientId ? "MY PAGE" : "TOP"}
        </Link>
        <span className="ml-auto text-[10px] tracking-[0.2em] text-ink-400">
          RESULT
          {saveState === "saved" && (
            <span className="ml-2 text-emerald-600 normal-case tracking-normal">
              ✓ 保存済み
            </span>
          )}
          {saveState === "saving" && (
            <span className="ml-2 text-ink-400 normal-case tracking-normal">
              保存中…
            </span>
          )}
        </span>
      </div>

      {/* Type card with overall constitution score */}
      <section className="rounded-2xl border border-ink-100 bg-gradient-to-b from-accent-50 to-white p-5 shadow-soft mb-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] tracking-[0.2em] text-accent-600 font-bold mb-1">
              YOUR TYPE
            </div>
            <h1 className="text-[26px] font-black text-ink-900 leading-tight">
              {content.name}
            </h1>
            {primary && (
              <div className="mt-1 text-xs text-ink-500">主軸 : {primary}</div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] tracking-widest text-ink-400">体質スコア</div>
            <div className="text-3xl font-black text-ink-900 tabular-nums leading-tight">
              {constitutionScore(result.axes)}
              <span className="text-xs text-ink-400">/100</span>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-700">
          {content.tagline}
        </p>
      </section>

      {/* Radar */}
      <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft mb-5">
        <h2 className="text-xs tracking-widest text-ink-400 mb-2">
          体質スコア / 3軸
        </h2>
        <div className="flex justify-center">
          <RadarChart axes={result.axes} size={300} />
        </div>
        <p className="text-[11px] text-ink-400 text-center mt-1">
          数値が大きいほど、その軸が良好な状態であることを示します
        </p>
      </section>

      {/* Axis details */}
      <section className="space-y-2.5 mb-5">
        {axisOrder.map((k) => (
          <AxisBar key={k} result={result.axes[k]} />
        ))}
        <details className="rounded-xl border border-ink-100 bg-ink-50 px-4 py-3 text-xs text-ink-500 leading-relaxed">
          <summary className="cursor-pointer font-bold text-ink-700">
            3軸の意味について
          </summary>
          <div className="mt-2 space-y-2">
            {axisOrder.map((k) => (
              <div key={k}>
                <span className="font-bold text-ink-900">
                  {AXIS_LABEL[k].ja}
                </span>
                <span className="text-ink-400 ml-1">({AXIS_LABEL[k].role})</span>
                <span className="block">{AXIS_DESC[k]}</span>
              </div>
            ))}
          </div>
        </details>
      </section>

      {/* Tab switch */}
      <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-ink-50 rounded-full">
        {(
          [
            { key: "summary", label: "解説" },
            { key: "advice", label: "改善アドバイス" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "rounded-full py-2.5 text-sm font-bold transition",
              tab === t.key
                ? "bg-white text-ink-900 shadow-soft"
                : "text-ink-500 hover:text-ink-700",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "summary" ? (
        <section className="space-y-4">
          <Block title="特徴 / 身体の状態" items={content.features.body} />
          <Block title="起きやすい症状" items={content.features.symptoms} />
          <Block title="原因 / 生活習慣" items={content.causes.lifestyle} />
          <Block title="原因 / 思考パターン" items={content.causes.mindset} />
          <Block title="このまま放置すると" items={content.risks} tone="risk" />
        </section>
      ) : (
        <section className="space-y-4">
          <AdviceBlock title="睡眠" emoji="🌙" items={content.advice.sleep} />
          <AdviceBlock title="食事" emoji="🥣" items={content.advice.food} />
          <AdviceBlock title="運動" emoji="🚶" items={content.advice.exercise} />
          <AdviceBlock title="ストレス" emoji="🌿" items={content.advice.stress} />
          <p className="text-[11px] text-ink-400 leading-relaxed mt-3">
            ※
            体調に著しい異常がある場合は医療機関を受診してください。本アプリは医療行為の代替ではありません。
          </p>
        </section>
      )}

      {/* Bottom actions — destination depends on who performed the diagnosis. */}
      <div className="mt-8 grid gap-3">
        {role === "admin" && patientId ? (
          <Link
            href={`/admin/patients/${patientId}`}
            onClick={() => clearDiagnose()}
            className="block w-full text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition active:scale-[0.99]"
          >
            お客様管理画面に戻る
          </Link>
        ) : role === "patient" ? (
          <Link
            href="/me/dashboard"
            onClick={() => clearDiagnose()}
            className="block w-full text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition active:scale-[0.99]"
          >
            マイページへ（ログイン不要）
          </Link>
        ) : (
          <Link
            href="/diagnose"
            onClick={() => clearDiagnose()}
            className="block w-full text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition active:scale-[0.99]"
          >
            もう一度診断する
          </Link>
        )}
        <Link
          href="/"
          className="block w-full text-center rounded-full border border-ink-200 text-ink-700 font-bold py-3.5"
        >
          トップに戻る
        </Link>
      </div>
    </main>
  );
}

function Block({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone?: "risk";
}) {
  return (
    <div
      className={[
        "rounded-xl border p-4 shadow-soft",
        tone === "risk"
          ? "border-ng/30 bg-rose-50/50"
          : "border-ink-100 bg-white",
      ].join(" ")}
    >
      <div
        className={[
          "text-[11px] tracking-widest font-bold mb-2",
          tone === "risk" ? "text-ng" : "text-ink-400",
        ].join(" ")}
      >
        {title}
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-ink-800 leading-relaxed flex gap-2">
            <span
              className={[
                "mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0",
                tone === "risk" ? "bg-ng" : "bg-accent",
              ].join(" ")}
            />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdviceBlock({
  title,
  emoji,
  items,
}: {
  title: string;
  emoji: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-4 shadow-soft">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-lg leading-none" aria-hidden>
          {emoji}
        </span>
        <span className="font-bold text-ink-900">{title}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-ink-800 leading-relaxed flex gap-2">
            <span className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0 bg-accent" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
