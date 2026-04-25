import Link from "next/link";
import { getAuthenticatedPatientId, isAdminAuthenticated } from "@/lib/auth";
import { getPatientById } from "@/lib/db";
import RadarChart from "@/components/RadarChart";
import { AXIS_LABEL, type AxisKey, type AxisResult } from "@/lib/types";

export const dynamic = "force-dynamic";

// Hard-coded before/after sample shown on the landing page to communicate that
// the app visualises changes over time. The "previous" snapshot is more
// off-balance and the "current" one shows clear improvement on every axis,
// which is the value proposition for returning patients.
const SAMPLE_PREV_AXES: Record<AxisKey, AxisResult> = {
  nerve: { axis: "nerve", raw: 22, normalized: 85, level: "strong" },
  circ: { axis: "circ", raw: 16, normalized: 65, level: "mild" },
  metab: { axis: "metab", raw: 15, normalized: 60, level: "mild" },
};
const SAMPLE_AXES: Record<AxisKey, AxisResult> = {
  nerve: { axis: "nerve", raw: 16, normalized: 60, level: "mild" },
  circ: { axis: "circ", raw: 13, normalized: 50, level: "balanced" },
  metab: { axis: "metab", raw: 12, normalized: 45, level: "balanced" },
};

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

      {/* Result preview — show before/after comparison so visitors immediately
          understand the app tracks improvement over time, not just snapshots. */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs tracking-widest text-ink-400">
            BEFORE / AFTER
          </h2>
          <span className="text-[10px] tracking-widest text-accent-600 font-bold bg-accent-50 px-2 py-0.5 rounded-full">
            SAMPLE
          </span>
        </div>
        <p className="text-xs text-ink-500 mb-3 leading-relaxed">
          通院前後の体質変化が一目でわかります
        </p>

        <div className="rounded-2xl border border-ink-100 bg-white shadow-soft overflow-hidden">
          {/* Date legend */}
          <div className="grid grid-cols-2 border-b border-ink-100 text-center">
            <div className="py-2.5 border-r border-ink-100">
              <div className="text-[10px] tracking-widest text-ink-400 mb-0.5">
                前回（初診時）
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block w-3 h-0.5 border-t-2 border-dashed border-ink-400"
                />
                <span className="text-xs font-bold text-ink-700 tabular-nums">
                  3/15
                </span>
              </div>
            </div>
            <div className="py-2.5 bg-accent-50/40">
              <div className="text-[10px] tracking-widest text-accent-600 font-bold mb-0.5">
                今回
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <span
                  aria-hidden
                  className="inline-block w-3 h-0.5 bg-accent rounded-full"
                />
                <span className="text-xs font-bold text-ink-900 tabular-nums">
                  4/25
                </span>
              </div>
            </div>
          </div>

          {/* Comparison radar */}
          <div className="bg-gradient-to-b from-accent-50/60 to-white px-2 pt-3 pb-1 flex justify-center">
            <RadarChart
              axes={SAMPLE_AXES}
              compare={SAMPLE_PREV_AXES}
              compareLabel="前回 (3/15)"
              size={260}
            />
          </div>

          {/* Per-axis change */}
          <div className="border-t border-ink-100 px-5 py-4">
            <div className="text-[10px] tracking-widest text-ink-400 font-bold mb-2">
              前回からの変化
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["nerve", "circ", "metab"] as const).map((k) => {
                const cur = SAMPLE_AXES[k].normalized;
                const prev = SAMPLE_PREV_AXES[k].normalized;
                const delta = cur - prev;
                return (
                  <div
                    key={k}
                    className="rounded-xl border border-ink-100 bg-ink-50 px-2 py-2 text-center"
                  >
                    <div className="text-[10px] tracking-widest text-ink-400">
                      {AXIS_LABEL[k].ja}
                    </div>
                    <div className="text-base font-black text-ink-900 tabular-nums leading-tight mt-0.5">
                      {cur}
                    </div>
                    <div className="text-[11px] tabular-nums font-bold text-emerald-600">
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-emerald-600 text-center mt-2 font-bold">
              ↓ 数値が下がるほど不調が改善しています
            </p>
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
