import Link from "next/link";
import { getAuthenticatedPatientId, isAdminAuthenticated } from "@/lib/auth";
import { getPatientById } from "@/lib/db";
import RadarChart from "@/components/RadarChart";
import { contentForType } from "@/lib/content";
import type { AxisKey, AxisResult } from "@/lib/types";

export const dynamic = "force-dynamic";

// Hard-coded sample result used purely as a marketing preview on the landing
// page. Picked an off-balance "nerve_excess" shape so the radar chart looks
// visually interesting (a perfect equilateral triangle reads as "no result").
const SAMPLE_AXES: Record<AxisKey, AxisResult> = {
  nerve: { axis: "nerve", raw: 19, normalized: 75, level: "off" },
  circ: { axis: "circ", raw: 13, normalized: 50, level: "mild" },
  metab: { axis: "metab", raw: 12, normalized: 45, level: "balanced" },
};
const SAMPLE_TYPE = contentForType("nerve_excess");

export default async function Home() {
  const patientId = getAuthenticatedPatientId();
  const patient = patientId ? await getPatientById(patientId).catch(() => null) : null;
  const adminAuthed = isAdminAuthenticated();

  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-12 fade-up">
      {/* Brand */}
      <header className="flex items-center gap-2.5 mb-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo-mark.png"
          alt=""
          aria-hidden
          className="h-9 w-auto"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo/logo-wordmark-jp.png"
          alt="リカバリー鍼灸院"
          className="h-5 w-auto"
        />
        <span className="text-[10px] tracking-[0.18em] text-ink-400 ml-1">
          / 体質診断
        </span>
      </header>

      <section className="mb-7">
        <h1 className="text-[28px] leading-[1.35] font-black text-ink-900 mb-3">
          身体の状態を、
          <br />
          見える化しよう。
        </h1>
        <p className="text-sm leading-relaxed text-ink-500">
          神経・循環・代謝の3軸で、あなたの体質をやさしく可視化します。
          原因と、今日できる改善のヒントまで、一気通貫でわかる体質診断です。
        </p>
      </section>

      {/* Primary actions */}
      <section className="grid gap-3 mb-10">
        <Link
          href="/diagnose"
          className="block w-full text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-4 shadow-soft hover:bg-accent-400 transition active:scale-[0.99]"
        >
          無料で体質診断をはじめる
        </Link>
        <Link
          href={patient ? "/me/dashboard" : "/me"}
          className="block w-full text-center rounded-full border-2 border-ink-200 text-ink-800 font-black tracking-widest py-3.5 hover:border-accent hover:text-ink-900 transition active:scale-[0.99]"
        >
          {patient ? "マイページへ" : "ログイン"}
        </Link>
        <p className="text-[11px] text-center text-ink-400 mt-1">
          初めての方も登録不要で2-3分でお試しいただけます
        </p>
      </section>

      {/* Returning patient welcome card (only when logged in) */}
      {patient && (
        <Link
          href="/me/dashboard"
          className="mb-10 flex items-center justify-between rounded-2xl border border-accent bg-accent-50 px-4 py-4 shadow-soft hover:bg-accent-100 transition"
        >
          <div>
            <div className="text-[10px] tracking-widest text-accent-600 font-bold mb-0.5">
              ようこそ
            </div>
            <div className="text-base font-black text-ink-900">
              {patient.name} さん
            </div>
            <div className="text-[11px] text-ink-500 mt-0.5">
              {patient.chart_number} ・ 診断履歴を見る
            </div>
          </div>
          <span className="text-ink-400 text-2xl leading-none">›</span>
        </Link>
      )}

      {/* Feature cards */}
      <section className="grid grid-cols-3 gap-2.5 mb-8">
        {[
          { jp: "神経", en: "Nervous", role: "指令" },
          { jp: "循環", en: "Circulation", role: "供給" },
          { jp: "代謝", en: "Metabolism", role: "排出" },
        ].map((a) => (
          <div
            key={a.en}
            className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-3 text-center shadow-soft"
          >
            <div className="text-[10px] tracking-widest text-ink-400 mb-0.5">
              {a.en.toUpperCase()}
            </div>
            <div className="text-base font-black text-ink-900">{a.jp}</div>
            <div className="text-[10px] text-ink-400 mt-0.5">{a.role}</div>
          </div>
        ))}
      </section>

      {/* Result preview — gives first-time visitors a concrete idea of the output */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs tracking-widest text-ink-400">
            RESULT PREVIEW
          </h2>
          <span className="text-[10px] tracking-widest text-accent-600 font-bold bg-accent-50 px-2 py-0.5 rounded-full">
            SAMPLE
          </span>
        </div>
        <p className="text-xs text-ink-500 mb-3 leading-relaxed">
          診断後、あなただけの結果がこのように表示されます
        </p>

        <div className="rounded-2xl border border-ink-100 bg-white shadow-soft overflow-hidden">
          <div className="bg-gradient-to-b from-accent-50/60 to-white px-2 pt-3 pb-1 flex justify-center">
            <RadarChart axes={SAMPLE_AXES} size={260} />
          </div>
          <div className="border-t border-ink-100 px-5 py-4">
            <div className="text-[10px] tracking-widest text-accent-600 font-bold mb-1">
              YOUR TYPE
            </div>
            <h3 className="text-lg font-black text-ink-900 leading-tight">
              {SAMPLE_TYPE.name}
            </h3>
            <p className="text-xs text-ink-500 leading-relaxed mt-1.5">
              {SAMPLE_TYPE.tagline}
            </p>
          </div>
          <div className="border-t border-ink-100 px-5 py-3 bg-ink-50/60">
            <div className="text-[10px] tracking-widest text-ink-400 font-bold mb-1.5">
              改善アドバイス（一部）
            </div>
            <ul className="space-y-1">
              {[
                ["🌙", SAMPLE_TYPE.advice.sleep[0]],
                ["🥣", SAMPLE_TYPE.advice.food[0]],
                ["🚶", SAMPLE_TYPE.advice.exercise[0]],
              ].map(([emoji, txt], i) => (
                <li
                  key={i}
                  className="text-xs text-ink-700 leading-relaxed flex gap-2"
                >
                  <span aria-hidden>{emoji}</span>
                  <span className="flex-1">{txt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mb-10">
        <h2 className="text-xs tracking-widest text-ink-400 mb-3">
          DIAGNOSE FLOW
        </h2>
        <ol className="space-y-3">
          {[
            { n: "01", t: "15問の問診", d: "1問あたり10秒。タップで直感的に回答" },
            { n: "02", t: "3軸レーダーで可視化", d: "あなたのタイプを判定" },
            { n: "03", t: "今日からできる改善案", d: "睡眠 / 食事 / 運動 / ストレス" },
          ].map((s) => (
            <li
              key={s.n}
              className="flex items-start gap-3 rounded-xl bg-white border border-ink-100 px-4 py-3 shadow-soft"
            >
              <span className="text-accent-600 font-black tracking-tighter text-xl tabular-nums leading-none mt-0.5">
                {s.n}
              </span>
              <div>
                <div className="font-bold text-ink-900 text-sm">{s.t}</div>
                <div className="text-xs text-ink-500 mt-0.5">{s.d}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Staff entry (small, footer-like) */}
      <div className="pt-6 border-t border-ink-100 text-center">
        <Link
          href={adminAuthed ? "/admin" : "/admin/login"}
          className="inline-block text-[11px] tracking-widest text-ink-400 hover:text-ink-700"
        >
          STAFF / {adminAuthed ? "管理画面へ" : "スタッフログイン"}
        </Link>
      </div>
    </main>
  );
}
