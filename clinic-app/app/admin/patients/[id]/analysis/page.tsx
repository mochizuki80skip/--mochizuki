import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessPatient, requireAdmin } from "@/lib/guards";
import {
  getLastVisitBefore,
  getPatientById,
  listDailyLogsForPatient,
  listDiagnosesForPatient,
  listVisitsForPatient,
} from "@/lib/db";
import { analyzePatient, ymd } from "@/lib/analysis";
import { moodFor } from "@/lib/symptoms";
import { contentForType } from "@/lib/content";
import AdminHeader from "../../../AdminHeader";
import PeriodPicker from "./PeriodPicker";
import CopySummaryButton from "./CopySummaryButton";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

function formatRange(from: string, to: string): string {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  const sameYear = f.getFullYear() === t.getFullYear();
  const fStr = `${f.getFullYear()}/${f.getMonth() + 1}/${f.getDate()}`;
  const tStr = sameYear
    ? `${t.getMonth() + 1}/${t.getDate()}`
    : `${t.getFullYear()}/${t.getMonth() + 1}/${t.getDate()}`;
  return `${fStr} 〜 ${tStr}`;
}

export default async function AnalysisPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string; to?: string };
}) {
  const ctx = requireAdmin();
  const patient = await getPatientById(params.id);
  if (!patient) notFound();
  if (!canAccessPatient(patient, ctx)) redirect("/admin/forbidden");

  const today = new Date();
  const todayKey = ymd(today);
  const defaultFrom = shift(todayKey, -13); // default = 14日間
  const fromQ =
    typeof searchParams.from === "string" && DATE_RE.test(searchParams.from)
      ? searchParams.from
      : defaultFrom;
  const toQ =
    typeof searchParams.to === "string" && DATE_RE.test(searchParams.to)
      ? searchParams.to
      : todayKey;
  const from = fromQ <= toQ ? fromQ : defaultFrom;
  const to = toQ >= from ? toQ : todayKey;

  const [logs, visits, diagnoses, lastVisitBefore] = await Promise.all([
    listDailyLogsForPatient(patient.id),
    listVisitsForPatient(patient.id),
    listDiagnosesForPatient(patient.id),
    getLastVisitBefore(patient.id, todayKey),
  ]);

  const result = analyzePatient({
    patient,
    period: { from, to },
    logs,
    visits,
    diagnoses,
  });

  const moodAvg = result.mood.avg;
  const moodOpt = moodAvg != null ? moodFor(Math.round(moodAvg)) : null;

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-12 fade-up">
      <AdminHeader role={ctx.role} />

      <div className="mb-3 flex items-center gap-3">
        <Link
          href={`/admin/patients/${patient.id}`}
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← {patient.chart_number} {patient.name}
        </Link>
      </div>

      <h1 className="text-[22px] font-black text-ink-900 mb-1">
        体調分析
      </h1>
      <p className="text-xs text-ink-500 mb-5">
        記録された日々の体調から、推奨される施術と来院前後の変化を分析します
      </p>

      <PeriodPicker
        patientId={patient.id}
        todayKey={todayKey}
        current={{ from, to }}
        lastVisitKey={lastVisitBefore?.visit_date ?? null}
      />

      {/* Period overview */}
      <section className="mb-5 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        <div className="text-[10px] tracking-widest text-ink-400 mb-1">期間</div>
        <div className="text-base font-black text-ink-900 tabular-nums">
          {formatRange(from, to)}（{result.period.days}日間）
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <CountCard label="記録" value={result.counts.logs} unit="日分" />
          <CountCard label="来院" value={result.counts.visits} unit="回" />
          <CountCard label="診断" value={result.counts.diagnoses} unit="回" />
        </div>
      </section>

      {/* Body condition */}
      <section className="mb-5 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        <h2 className="text-[10px] tracking-widest text-ink-400 font-bold mb-3">
          体調の傾向
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <SummaryCard
            label="気分"
            value={
              moodOpt ? `${moodOpt.emoji} ${moodAvg!.toFixed(1)}` : null
            }
            sub={
              result.mood.trend === "up"
                ? "改善傾向 ↑"
                : result.mood.trend === "down"
                ? "悪化傾向 ↓"
                : result.mood.trend === "flat"
                ? "横ばい →"
                : null
            }
          />
          <SummaryCard
            label="睡眠"
            value={
              result.sleep.avg != null
                ? `約${result.sleep.avg}時間`
                : null
            }
          />
          <SummaryCard
            label="血圧"
            value={
              result.bp.systolic != null && result.bp.diastolic != null
                ? `${result.bp.systolic}/${result.bp.diastolic}`
                : null
            }
            sub={
              result.bp.systolic != null ? "mmHg" : null
            }
          />
        </div>
      </section>

      {/* Pains / Symptoms */}
      <section className="mb-5 grid grid-cols-1 gap-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
          <h2 className="text-[10px] tracking-widest text-ink-400 font-bold mb-2">
            痛みランキング
          </h2>
          {result.pains.length === 0 ? (
            <p className="text-xs text-ink-500">記録された痛みはありません</p>
          ) : (
            <ul className="space-y-1.5">
              {result.pains.slice(0, 5).map((p) => (
                <li
                  key={`${p.area}:${p.side ?? ""}`}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="text-rose-600 font-bold">●</span>
                  <span className="font-bold text-ink-900">{p.label}</span>
                  <span className="ml-auto text-ink-500 tabular-nums">
                    {p.count}日 / 強度 {p.avgStrength}
                    <span className="text-[10px] text-ink-400">
                      （最大{p.maxStrength}）
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
          <h2 className="text-[10px] tracking-widest text-ink-400 font-bold mb-2">
            症状ランキング
          </h2>
          {result.symptoms.length === 0 ? (
            <p className="text-xs text-ink-500">記録された症状はありません</p>
          ) : (
            <ul className="space-y-1.5">
              {result.symptoms.slice(0, 5).map((s) => (
                <li
                  key={s.key}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="text-amber-600 font-bold">●</span>
                  <span className="font-bold text-ink-900">{s.label}</span>
                  <span className="ml-auto text-ink-500 tabular-nums">
                    {s.count}日
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Treatment recommendation */}
      <section className="mb-5 rounded-2xl border-2 border-accent bg-accent-50/40 p-4 shadow-soft">
        <h2 className="text-[10px] tracking-widest text-accent-600 font-bold mb-2">
          推奨される施術カテゴリ
        </h2>
        {result.treatmentSuggestion.categories.length === 0 ? (
          <div>
            <div className="text-base font-black text-ink-900 mb-1">
              バランス調整
            </div>
            <p className="text-xs text-ink-700 leading-relaxed">
              特定カテゴリへの偏りは見られません。全身バランスを整える施術が推奨されます。
            </p>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {result.treatmentSuggestion.categories.map((c) => (
                <span
                  key={c.key}
                  className="inline-flex items-center gap-1 rounded-full bg-white border-2 border-accent px-3 py-1 text-sm font-black text-ink-900"
                >
                  <span aria-hidden>{c.emoji}</span>
                  {c.name}
                </span>
              ))}
              {result.treatmentSuggestion.isCompound && (
                <span className="inline-flex items-center rounded-full bg-ink-900 text-white px-2 py-1 text-[10px] font-bold tracking-widest">
                  複合
                </span>
              )}
            </div>
            <ul className="space-y-1 mt-2">
              {result.treatmentSuggestion.categories.map((c) => (
                <li key={c.key} className="text-xs text-ink-700 leading-relaxed">
                  <span className="font-bold">{c.emoji} {c.name}</span> ─ {c.approach}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-500 mt-3 leading-relaxed">
              判定理由: {result.treatmentSuggestion.reason}
            </p>
          </div>
        )}
      </section>

      {/* Diagnose comparison (within period) */}
      {result.diagnoseDelta && (
        <section className="mb-5 rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
          <h2 className="text-[10px] tracking-widest text-ink-400 font-bold mb-3">
            期間内の診断変化
          </h2>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-center">
              <div className="text-[10px] text-ink-400">前</div>
              <div className="text-2xl font-black text-ink-900 tabular-nums">
                {result.diagnoseDelta.overallFrom}
              </div>
              <div className="text-[10px] text-ink-400">
                {contentForType(result.diagnoseDelta.from.type_key).name}
              </div>
            </div>
            <div className="flex-1 text-center">
              <span className="text-2xl text-ink-300">→</span>
              <div
                className={[
                  "text-sm font-black tabular-nums mt-1",
                  result.diagnoseDelta.overallDelta > 0
                    ? "text-emerald-600"
                    : result.diagnoseDelta.overallDelta < 0
                    ? "text-rose-600"
                    : "text-ink-400",
                ].join(" ")}
              >
                {result.diagnoseDelta.overallDelta > 0 ? "+" : ""}
                {result.diagnoseDelta.overallDelta}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-ink-400">後</div>
              <div className="text-2xl font-black text-ink-900 tabular-nums">
                {result.diagnoseDelta.overallTo}
              </div>
              <div className="text-[10px] text-ink-400">
                {contentForType(result.diagnoseDelta.to.type_key).name}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {(["nerve", "circ", "metab"] as const).map((k) => {
              const a = result.diagnoseDelta!.axes[k];
              const tone =
                a.delta > 0
                  ? "text-emerald-600"
                  : a.delta < 0
                  ? "text-rose-600"
                  : "text-ink-400";
              const label = k === "nerve" ? "神経" : k === "circ" ? "循環" : "代謝";
              return (
                <div
                  key={k}
                  className="rounded-xl border border-ink-100 bg-ink-50 px-2 py-2"
                >
                  <div className="text-[10px] text-ink-400">{label}</div>
                  <div className="font-black text-ink-900 tabular-nums">
                    {a.from} → {a.to}
                  </div>
                  <div className={`text-[11px] font-bold tabular-nums ${tone}`}>
                    {a.delta > 0 ? "+" : ""}
                    {a.delta}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Copy-to-clipboard summary */}
      <section className="mb-5 rounded-2xl border border-ink-900 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] tracking-widest text-ink-400 font-bold">
            スタッフ共有用サマリー
          </h2>
          <CopySummaryButton text={result.copyText} />
        </div>
        <textarea
          id="copy-summary-text"
          readOnly
          value={result.copyText}
          rows={Math.max(6, result.copyText.split("\n").length + 1)}
          className="block w-full rounded-lg border border-ink-100 bg-ink-50 px-3 py-2.5 text-xs text-ink-900 leading-relaxed font-mono"
        />
        <p className="text-[10px] text-ink-400 mt-2 leading-relaxed">
          ※ コピーしたテキストはLINE・院内ノート・メールなどに貼り付けてご利用ください
        </p>
      </section>
    </main>
  );
}

function CountCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50 px-3 py-2 text-center">
      <div className="text-[10px] tracking-widest text-ink-400">{label}</div>
      <div className="text-xl font-black text-ink-900 tabular-nums leading-tight">
        {value}
        <span className="text-[10px] text-ink-400 font-normal ml-0.5">{unit}</span>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | null;
  sub?: string | null;
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-soft text-center">
      <div className="text-[10px] tracking-widest text-ink-400">{label}</div>
      <div className="text-sm font-black text-ink-900 leading-tight mt-1 min-h-[1.5rem]">
        {value || <span className="text-ink-300 text-xs font-normal">未記入</span>}
      </div>
      {sub && (
        <div className="text-[10px] text-ink-500 mt-0.5">{sub}</div>
      )}
    </div>
  );
}
