"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HistoryCalendar from "@/components/HistoryCalendar";
import { contentForType } from "@/lib/content";
import {
  BODY_PART_LABEL,
  PAIN_SIDE_LABEL,
  SYMPTOM_LABEL,
  moodFor,
} from "@/lib/symptoms";
import type {
  DailyLog,
  DiagnosisRow,
  PainRecord,
  Visit,
} from "@/lib/types";

type Props = {
  patientId: string;
  diagnoses: DiagnosisRow[];
  logs: DailyLog[];
  visits: Visit[];
};

function formatDayHeader(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${wd})`;
}

export default function StaffCalendarSection({
  patientId,
  diagnoses,
  logs,
  visits,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const diag = new Map<string, DiagnosisRow>();
    for (const d of diagnoses) diag.set(d.diagnosed_at.slice(0, 10), d);
    const log = new Map<string, DailyLog>();
    for (const l of logs) log.set(l.log_date, l);
    const visit = new Map<string, Visit>();
    for (const v of visits) visit.set(v.visit_date, v);
    return { diag, log, visit };
  }, [diagnoses, logs, visits]);

  function toggleDay(ymd: string) {
    setError(null);
    setSelected((prev) => (prev === ymd ? null : ymd));
  }

  async function recordVisit(date: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/patients/${patientId}/visits`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visit_date: date }),
        },
      );
      if (!res.ok) {
        setError("記録に失敗しました");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  async function deleteVisit(date: string) {
    const ok = window.confirm(
      `${formatDayHeader(date)} の来院記録を取り消しますか？`,
    );
    if (!ok) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/patients/${patientId}/visits/${date}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setError("取り消しに失敗しました");
        return;
      }
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  const sel = selected;
  const day = sel
    ? {
        diagnosis: byDate.diag.get(sel) ?? null,
        log: byDate.log.get(sel) ?? null,
        visit: byDate.visit.get(sel) ?? null,
      }
    : null;

  return (
    <>
      <HistoryCalendar
        diagnoses={diagnoses.map((d) => ({
          date: d.diagnosed_at,
          href: `/admin/patients/${patientId}/diagnoses/${d.id}`,
        }))}
        logs={logs.map((l) => ({
          date: `${l.log_date}T00:00:00`,
          href: `/admin/patients/${patientId}/logs/${l.log_date}`,
        }))}
        visits={visits.map((v) => ({
          date: `${v.visit_date}T00:00:00`,
          href: `/admin/patients/${patientId}/logs/${v.visit_date}`,
        }))}
        onDayClick={toggleDay}
        selectedDate={selected}
      />

      {sel && day && (
        <div className="mt-3 rounded-2xl border-2 border-accent bg-white shadow-soft overflow-hidden fade-up">
          <div className="px-4 py-3 bg-accent-50 flex items-center justify-between">
            <div className="text-sm font-black text-ink-900 tabular-nums">
              {formatDayHeader(sel)} の記録
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="text-[11px] text-ink-500 hover:text-ink-900"
            >
              閉じる
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Diagnosis */}
            <Row icon="🟡" label="体質診断" empty={!day.diagnosis}>
              {day.diagnosis && (
                <Link
                  href={`/admin/patients/${patientId}/diagnoses/${day.diagnosis.id}`}
                  className="flex items-center justify-between rounded-lg bg-accent-50 border border-accent px-3 py-2 hover:bg-accent-100 transition"
                >
                  <span className="text-sm font-bold text-ink-900">
                    {contentForType(day.diagnosis.type_key).name}
                  </span>
                  <span className="text-xs text-accent-600 font-bold">
                    詳細を見る ›
                  </span>
                </Link>
              )}
            </Row>

            {/* Daily log */}
            <Row icon="🟢" label="体調の記録" empty={!day.log}>
              {day.log && (
                <Link
                  href={`/admin/patients/${patientId}/logs/${sel}`}
                  className="flex items-start justify-between gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 hover:bg-emerald-100 transition"
                >
                  <LogPreview log={day.log} />
                  <span className="text-xs text-emerald-700 font-bold whitespace-nowrap">
                    詳細を見る ›
                  </span>
                </Link>
              )}
            </Row>

            {/* Visit — staff can add/delete inline */}
            <Row icon="🔵" label="来院" empty={!day.visit}>
              {day.visit ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
                    <span className="text-sm font-bold text-sky-900">
                      ✓ 来院記録あり
                      {day.visit.recorded_by === "patient" && (
                        <span className="text-[10px] text-sky-500 ml-1">
                          (患者本人記録)
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteVisit(sel)}
                      disabled={busy}
                      className="text-xs text-sky-700 hover:text-rose-600 underline disabled:opacity-50"
                    >
                      取り消す
                    </button>
                  </div>
                  <Link
                    href={`/admin/patients/${patientId}/charts/new?visit_id=${day.visit.id}`}
                    className="block w-full text-center rounded-full bg-ink-900 text-white font-bold text-sm py-2.5 hover:bg-ink-700 transition"
                  >
                    🩺 鍼灸カルテを開く
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => recordVisit(sel)}
                  disabled={busy}
                  className="block w-full text-center rounded-full border-2 border-sky-400 text-sky-700 font-bold text-sm py-2.5 hover:bg-sky-50 transition disabled:opacity-50"
                >
                  {busy ? "記録中..." : "＋ 来院を記録する"}
                </button>
              )}
            </Row>

            {error && (
              <div className="rounded-lg bg-rose-50 text-rose-700 text-xs px-3 py-2 border border-rose-200">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Row({
  icon,
  label,
  empty,
  children,
}: {
  icon: string;
  label: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] tracking-widest text-ink-400 font-bold">
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
        {empty && <span className="text-ink-300 normal-case ml-1">なし</span>}
      </div>
      {children}
    </div>
  );
}

function LogPreview({ log }: { log: DailyLog }) {
  const m = moodFor(log.mood);
  const painCount = (log.pains || []).length;
  const symCount = (log.symptoms || []).length;
  const painLine = (log.pains || [])
    .slice(0, 2)
    .map((p: PainRecord) => {
      const base = BODY_PART_LABEL[p.area] || p.area;
      const side = p.side
        ? PAIN_SIDE_LABEL[p.side as keyof typeof PAIN_SIDE_LABEL]
        : "";
      return `${side}${base}(${p.strength})`;
    })
    .join(" / ");
  const symLine = (log.symptoms || [])
    .slice(0, 3)
    .map((s) => SYMPTOM_LABEL[s] || s)
    .join(" / ");
  return (
    <div className="text-xs text-ink-800 leading-relaxed flex-1 min-w-0">
      {m && (
        <div className="font-bold">
          {m.emoji} {m.label}
        </div>
      )}
      {painCount > 0 && (
        <div className="text-rose-700 truncate">
          痛み: {painLine}
          {painCount > 2 && ` 他${painCount - 2}`}
        </div>
      )}
      {symCount > 0 && (
        <div className="text-amber-700 truncate">
          症状: {symLine}
          {symCount > 3 && ` 他${symCount - 3}`}
        </div>
      )}
      {!m && painCount === 0 && symCount === 0 && (log.notes || "") && (
        <div className="text-ink-500 truncate">{log.notes}</div>
      )}
    </div>
  );
}
