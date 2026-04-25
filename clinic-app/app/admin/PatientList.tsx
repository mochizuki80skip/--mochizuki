"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Patient } from "@/lib/types";

type Props = {
  patients: Patient[];
  latestMap: Record<string, string>;
};

type Filter = "all" | "recent" | "stale";

const RECENT_DAYS = 30;
const STALE_DAYS = 60;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function daysSince(iso: string | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
}

export default function PatientList({ patients, latestMap }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return patients.filter((p) => {
      if (term) {
        const hay = [p.chart_number, p.name, p.furigana || ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      const days = daysSince(latestMap[p.id]);
      if (filter === "recent") {
        if (days == null || days > RECENT_DAYS) return false;
      }
      if (filter === "stale") {
        if (days != null && days <= STALE_DAYS) return false;
      }
      return true;
    });
  }, [patients, latestMap, q, filter]);

  return (
    <>
      <div className="mb-3 space-y-2">
        <div className="relative">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="カルテ番号・氏名・ふりがなで検索"
            className="block w-full rounded-xl border border-ink-200 bg-white pl-9 pr-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <svg
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex gap-1.5 text-xs">
          {(
            [
              { k: "all", l: "すべて" },
              { k: "recent", l: `直近${RECENT_DAYS}日` },
              { k: "stale", l: `${STALE_DAYS}日以上未来院` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.k}
              onClick={() => setFilter(opt.k)}
              className={[
                "rounded-full px-3 py-1.5 font-bold transition",
                filter === opt.k
                  ? "bg-ink-900 text-white"
                  : "bg-ink-50 text-ink-500 hover:bg-ink-100",
              ].join(" ")}
            >
              {opt.l}
            </button>
          ))}
          <span className="ml-auto self-center text-[11px] text-ink-400 tabular-nums">
            {filtered.length} / {patients.length} 名
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-ink-500">
          <p className="text-sm">該当する患者が見つかりません。</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const latest = latestMap[p.id];
            const days = daysSince(latest);
            const stale = days != null && days > STALE_DAYS;
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/patients/${p.id}`}
                  className="block rounded-xl border border-ink-100 bg-white px-4 py-3.5 shadow-soft hover:border-accent transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] tracking-widest text-ink-400 tabular-nums">
                          {p.chart_number}
                        </span>
                        <span className="font-bold text-ink-900 truncate">
                          {p.name}
                        </span>
                      </div>
                      {p.furigana && (
                        <div className="text-[11px] text-ink-400 mt-0.5">
                          {p.furigana}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] tracking-widest text-ink-400">
                        最終診断
                      </div>
                      <div
                        className={[
                          "text-xs tabular-nums",
                          stale ? "text-rose-500 font-bold" : "text-ink-700",
                        ].join(" ")}
                      >
                        {formatDate(latest)}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
