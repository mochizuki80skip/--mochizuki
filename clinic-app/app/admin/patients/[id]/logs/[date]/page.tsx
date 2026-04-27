import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessPatient, requireAdmin } from "@/lib/guards";
import { getDailyLog, getPatientById } from "@/lib/db";
import {
  BODY_PART_LABEL,
  PAIN_SIDE_LABEL,
  SYMPTOMS_BY_CATEGORY,
  CATEGORY_LABEL,
  formatSleepHours,
  moodFor,
  symptomLabelFor,
} from "@/lib/symptoms";
import AdminHeader from "../../../../AdminHeader";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${wd})`;
}

export default async function StaffLogView({
  params,
}: {
  params: { id: string; date: string };
}) {
  const ctx = requireAdmin();
  if (!DATE_RE.test(params.date)) notFound();

  const patient = await getPatientById(params.id);
  if (!patient) notFound();
  if (!canAccessPatient(patient, ctx)) redirect("/admin/forbidden");
  const log = await getDailyLog(patient.id, params.date);

  const mood = log ? moodFor(log.mood) : null;
  const selected = new Set(log?.symptoms || []);
  const knownSymptomKeys = new Set(
    SYMPTOMS_BY_CATEGORY.nerve_auto.map((s) => s.key),
  );
  const legacySymptoms = (log?.symptoms || []).filter(
    (k) => !knownSymptomKeys.has(k),
  );

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12 fade-up">
      <AdminHeader role={ctx.role} />
      <div className="mb-3">
        <Link
          href={`/admin/patients/${patient.id}`}
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← {patient.chart_number} {patient.name}
        </Link>
      </div>

      <h1 className="text-[22px] font-black text-ink-900 mb-1">
        {formatDate(params.date)} の記録
      </h1>

      {!log ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
          この日の記録はありません
        </div>
      ) : (
        <div className="space-y-5 mt-5">
          {/* Top row: mood, sleep, BP */}
          <section className="grid grid-cols-3 gap-2">
            <SummaryCard
              label="本日の調子"
              value={mood?.emoji}
              sub={mood?.label}
            />
            <SummaryCard
              label="睡眠時間"
              value={
                log.sleep_hours != null
                  ? formatSleepHours(log.sleep_hours)
                  : null
              }
            />
            <SummaryCard
              label="血圧"
              value={
                log.bp_systolic != null && log.bp_diastolic != null
                  ? `${log.bp_systolic}/${log.bp_diastolic}`
                  : log.bp_systolic != null
                  ? `${log.bp_systolic}/—`
                  : null
              }
              sub={
                log.bp_systolic != null || log.bp_diastolic != null
                  ? "mmHg"
                  : undefined
              }
            />
          </section>

          {/* Pain */}
          <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
            <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-3">
              痛み ({log.pains.length})
            </h2>
            {log.pains.length === 0 ? (
              <p className="text-xs text-ink-500">なし</p>
            ) : (
              <ul className="space-y-2">
                {log.pains.map((p, i) => {
                  const label = BODY_PART_LABEL[p.area] || p.area;
                  const sideLabel = p.side ? PAIN_SIDE_LABEL[p.side] : null;
                  return (
                    <li
                      key={`${p.area}-${i}`}
                      className="flex items-center gap-3 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-rose-900">
                          {sideLabel && (
                            <span className="text-rose-600 mr-1">
                              {sideLabel}
                            </span>
                          )}
                          {label}
                        </div>
                        {p.area === "other" && p.free_text && (
                          <div className="text-[11px] text-rose-700 mt-0.5">
                            {p.free_text}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] tracking-widest text-rose-600 font-bold">
                          強さ
                        </div>
                        <div className="text-base font-black text-rose-700 tabular-nums leading-tight">
                          {p.strength}
                          <span className="text-[10px] text-rose-500">/5</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Neuro / autonomic symptoms */}
          <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
            <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-3">
              {CATEGORY_LABEL.nerve_auto} ({selected.size})
            </h2>
            {selected.size === 0 ? (
              <p className="text-xs text-ink-500">なし</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {SYMPTOMS_BY_CATEGORY.nerve_auto
                  .filter((s) => selected.has(s.key))
                  .map((s) => (
                    <span
                      key={s.key}
                      className="rounded-full bg-amber-50 text-amber-700 px-3 py-1 text-xs font-bold border border-amber-200"
                    >
                      {s.label}
                    </span>
                  ))}
                {legacySymptoms.map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-ink-50 text-ink-500 px-3 py-1 text-xs border border-ink-200"
                  >
                    {symptomLabelFor(k)}
                  </span>
                ))}
              </div>
            )}
          </section>

          {log.notes && (
            <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
              <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-2">
                患者ひとこと
              </h2>
              <p className="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap">
                {log.notes}
              </p>
            </section>
          )}

          <div className="text-[10px] text-ink-400 tabular-nums text-right">
            最終更新 {new Date(log.updated_at).toLocaleString("ja-JP")}
          </div>
        </div>
      )}

      <p className="text-[10px] text-ink-400 mt-6 leading-relaxed">
        ※ 編集は患者本人のマイページからのみ行えます。
      </p>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | null | undefined;
  sub?: string | null | undefined;
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-soft text-center">
      <div className="text-[10px] tracking-widest text-ink-400">{label}</div>
      <div className="text-base leading-tight mt-1 min-h-[1.75rem] flex items-center justify-center font-black text-ink-900">
        {value || <span className="text-ink-300 text-xs font-normal">未記入</span>}
      </div>
      {sub && <div className="text-[10px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  );
}
