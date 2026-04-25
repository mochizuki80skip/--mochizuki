import Link from "next/link";
import { getAuthenticatedPatientId, isAdminAuthenticated } from "@/lib/auth";
import { getPatientById } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const patientId = getAuthenticatedPatientId();
  const patient = patientId ? await getPatientById(patientId).catch(() => null) : null;
  const adminAuthed = isAdminAuthenticated();

  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-12 fade-up">
      {/* Brand */}
      <header className="flex items-center gap-2 mb-12">
        <span
          aria-hidden
          className="inline-block w-2 h-6 rounded-sm bg-accent shadow-glow"
        />
        <span className="text-sm font-black tracking-[0.12em] text-ink-900">
          リカバリー鍼灸院
        </span>
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
      <section className="grid grid-cols-3 gap-2.5 mb-10">
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
