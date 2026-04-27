"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function ymdKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Props = {
  /** Currently-saved visit dates (YYYY-MM-DD). Pre-selected. */
  initialDates: string[];
  /** Endpoint base for batch update — POST {added, removed} */
  apiBase: string;
  todayKey: string;
  /** Where to navigate when the user is done. */
  doneHref: string;
};

export default function VisitsCalendar({
  initialDates,
  apiBase,
  todayKey,
  doneHref,
}: Props) {
  const router = useRouter();
  const initialSet = useMemo(() => new Set(initialDates), [initialDates]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialDates),
  );
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date(`${todayKey}T00:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string, isFuture: boolean) {
    if (isFuture) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Diff vs initial
  const selectedArr = Array.from(selected);
  const initialArr = Array.from(initialSet);
  const added = selectedArr.filter((d) => !initialSet.has(d));
  const removed = initialArr.filter((d) => !selected.has(d));
  const dirty = added.length > 0 || removed.length > 0;

  function step(months: number) {
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + months, 1));
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ added, removed }),
      });
      if (!res.ok) {
        setError("保存に失敗しました");
        return;
      }
      router.replace(doneHref);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSaving(false);
    }
  }

  // Build calendar cells for current month
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            aria-label="前の月"
            onClick={() => step(-1)}
            className="w-9 h-9 rounded-full hover:bg-ink-50 text-ink-500"
          >
            ‹
          </button>
          <div className="text-base font-black text-ink-900 tabular-nums">
            {cursor.getFullYear()}年 {cursor.getMonth() + 1}月
          </div>
          <button
            type="button"
            aria-label="次の月"
            onClick={() => step(1)}
            className="w-9 h-9 rounded-full hover:bg-ink-50 text-ink-500"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] tracking-widest text-ink-400 mb-1">
          {WEEK_LABELS.map((w, i) => (
            <div
              key={w}
              className={i === 0 ? "text-rose-400" : i === 6 ? "text-sky-500" : ""}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="aspect-square" />;
            const key = ymdKey(d);
            const isFuture = key > todayKey;
            const isSel = selected.has(key);
            const wasInitial = initialSet.has(key);
            const dow = d.getDay();
            // Visual states:
            //   wasInitial && isSel       = saved (sky)
            //   !wasInitial && isSel      = newly added (ink-900)
            //   wasInitial && !isSel      = scheduled for delete (rose strike-through)
            //   else                      = empty
            let visual = "text-ink-700";
            if (isFuture) visual = "text-ink-300";
            else if (wasInitial && isSel)
              visual = "bg-sky-100 text-sky-800 ring-1 ring-sky-300 font-bold";
            else if (!wasInitial && isSel)
              visual = "bg-ink-900 text-white font-bold";
            else if (wasInitial && !isSel)
              visual =
                "bg-rose-50 text-rose-400 line-through ring-1 ring-rose-200";
            else if (dow === 0) visual = "text-rose-500";
            else if (dow === 6) visual = "text-sky-500";

            return (
              <button
                key={i}
                type="button"
                onClick={() => toggle(key, isFuture)}
                disabled={isFuture}
                className={[
                  "aspect-square flex items-center justify-center rounded-lg text-sm tabular-nums transition active:scale-[0.97]",
                  visual,
                  !isFuture && !isSel ? "hover:bg-ink-50" : "",
                ].join(" ")}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[10px] text-ink-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-sky-100 ring-1 ring-sky-300" />
            記録済み
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-ink-900" />
            追加予定
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-rose-50 ring-1 ring-rose-200" />
            削除予定
          </span>
        </div>
      </div>

      {/* Diff & save */}
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[10px] tracking-widest text-ink-400 font-bold">
            変更内容
          </span>
          {!dirty && (
            <span className="text-[10px] text-ink-400">変更なし</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          <div className="rounded-lg bg-ink-50 px-3 py-2">
            <div className="text-[10px] tracking-widest text-ink-400">追加</div>
            <div className="text-base font-black text-ink-900 tabular-nums">
              {added.length}
              <span className="text-[10px] text-ink-400 font-normal">件</span>
            </div>
          </div>
          <div className="rounded-lg bg-rose-50 px-3 py-2">
            <div className="text-[10px] tracking-widest text-rose-500">削除</div>
            <div className="text-base font-black text-rose-700 tabular-nums">
              {removed.length}
              <span className="text-[10px] text-rose-400 font-normal">件</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 text-rose-700 text-xs px-3 py-2 border border-rose-200 mb-2">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <a
            href={doneHref}
            className="flex-1 text-center rounded-full border border-ink-200 text-ink-700 font-bold py-3"
          >
            キャンセル
          </a>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="flex-[2] text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3 shadow-soft hover:bg-accent-400 disabled:bg-ink-100 disabled:text-ink-300 transition"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}
