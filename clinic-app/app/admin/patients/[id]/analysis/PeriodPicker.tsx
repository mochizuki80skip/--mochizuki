"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  patientId: string;
  todayKey: string;
  current: { from: string; to: string };
  /** YYYY-MM-DD of the most recent visit on or before today, if any. */
  lastVisitKey: string | null;
};

function shift(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PeriodPicker({
  patientId,
  todayKey,
  current,
  lastVisitKey,
}: Props) {
  const router = useRouter();
  const [from, setFrom] = useState(current.from);
  const [to, setTo] = useState(current.to);

  function goto(f: string, t: string) {
    router.push(`/admin/patients/${patientId}/analysis?from=${f}&to=${t}`);
  }

  const presets: Array<{ label: string; from: string; to: string }> = [
    { label: "直近1週間", from: shift(todayKey, -6), to: todayKey },
    { label: "直近2週間", from: shift(todayKey, -13), to: todayKey },
    { label: "直近30日", from: shift(todayKey, -29), to: todayKey },
  ];
  if (lastVisitKey) {
    presets.push({
      label: "前回来院日から",
      from: lastVisitKey,
      to: todayKey,
    });
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft mb-5">
      <div className="text-[10px] tracking-widest text-ink-400 mb-2 font-bold">
        分析期間
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {presets.map((p) => {
          const selected = current.from === p.from && current.to === p.to;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => goto(p.from, p.to)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-bold transition",
                selected
                  ? "bg-ink-900 text-white"
                  : "bg-ink-50 text-ink-700 border border-ink-200 hover:border-accent",
              ].join(" ")}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
          className="block w-full min-w-0 appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <span className="text-ink-400 text-xs">〜</span>
        <input
          type="date"
          value={to}
          min={from}
          max={todayKey}
          onChange={(e) => setTo(e.target.value)}
          className="block w-full min-w-0 appearance-none rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => goto(from, to)}
          disabled={!from || !to || from > to}
          className="rounded-full bg-accent text-ink-900 font-bold text-xs px-4 py-2 shadow-soft hover:bg-accent-400 disabled:bg-ink-100 disabled:text-ink-300"
        >
          適用
        </button>
      </div>
    </div>
  );
}
