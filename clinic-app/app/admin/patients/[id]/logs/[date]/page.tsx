import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/guards";
import { getDailyLog, getPatientById } from "@/lib/db";
import {
  CATEGORY_LABEL,
  SYMPTOMS_BY_CATEGORY,
  moodFor,
  type SymptomCategory,
} from "@/lib/symptoms";
import AdminHeader from "../../../../AdminHeader";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES: SymptomCategory[] = [
  "pain",
  "nerve",
  "circ",
  "metab",
  "other",
];

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
  requireAdmin();
  if (!DATE_RE.test(params.date)) notFound();

  const patient = await getPatientById(params.id);
  if (!patient) notFound();
  const log = await getDailyLog(patient.id, params.date);

  const mood = log ? moodFor(log.mood) : null;
  const sleep = log ? moodFor(log.sleep_quality) : null;
  const selected = new Set(log?.symptoms || []);

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12 fade-up">
      <AdminHeader />
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
          <section className="grid grid-cols-2 gap-2">
            <SummaryCard label="気分" value={mood?.emoji} sub={mood?.label} />
            <SummaryCard
              label="睡眠の質"
              value={sleep ? `${sleep.value}/5` : null}
              sub={sleep?.label}
            />
          </section>

          <section className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
            <h2 className="text-xs tracking-widest text-ink-400 font-bold mb-3">
              感じた不調 ({selected.size})
            </h2>
            {selected.size === 0 ? (
              <p className="text-xs text-ink-500">なし</p>
            ) : (
              <div className="space-y-3">
                {CATEGORIES.map((c) => {
                  const items = SYMPTOMS_BY_CATEGORY[c].filter((s) =>
                    selected.has(s.key),
                  );
                  if (items.length === 0) return null;
                  return (
                    <div key={c}>
                      <div className="text-[10px] tracking-widest text-ink-400 mb-1">
                        {CATEGORY_LABEL[c]}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((s) => (
                          <span
                            key={s.key}
                            className="rounded-full bg-rose-50 text-rose-700 px-3 py-1 text-xs font-bold border border-rose-200"
                          >
                            {s.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
  sub: string | null | undefined;
}) {
  return (
    <div className="rounded-xl border border-ink-100 bg-white p-3 shadow-soft text-center">
      <div className="text-[10px] tracking-widest text-ink-400">{label}</div>
      <div className="text-2xl leading-tight mt-1 h-8 flex items-center justify-center">
        {value || <span className="text-ink-300 text-sm">未記入</span>}
      </div>
      {sub && (
        <div className="text-[10px] text-ink-500 mt-0.5">{sub}</div>
      )}
    </div>
  );
}
