"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerListItem } from "./page";

function relDays(date: string | null): string {
  if (!date) return "未活動";
  const d = new Date(date);
  const today = new Date();
  d.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "今日";
  if (diff === 1) return "昨日";
  if (diff < 7) return `${diff}日前`;
  if (diff < 30) return `${Math.floor(diff / 7)}週前`;
  return `${Math.floor(diff / 30)}か月前`;
}

function staleness(date: string | null): "fresh" | "warn" | "stale" {
  if (!date) return "stale";
  const diff = Math.round(
    (Date.now() - new Date(date).getTime()) / 86400000
  );
  if (diff <= 7) return "fresh";
  if (diff <= 30) return "warn";
  return "stale";
}

export function CustomerListClient({ items }: { items: CustomerListItem[] }) {
  const [query, setQuery] = useState("");
  const [activity, setActivity] = useState<
    "all" | "fresh" | "warn" | "stale"
  >("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((c) => {
      if (q) {
        const hit =
          c.name.toLowerCase().includes(q) ||
          (c.goal ?? "").toLowerCase().includes(q) ||
          (c.tone_memo ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (activity !== "all") {
        if (staleness(c.last_report_date) !== activity) return false;
      }
      return true;
    });
  }, [items, query, activity]);

  return (
    <div className="space-y-4">
      <div className="bg-ink-900 text-white rounded-lg p-4 space-y-3">
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            キーワードでフィルター
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="名前・目標・距離感メモを検索"
            className="w-full bg-ink-800 border border-ink-700 text-white placeholder-gray-500 rounded px-3 py-2 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-300 mb-1">
            最近の活動でフィルター
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { v: "all", label: "全て" },
                { v: "fresh", label: "7日以内" },
                { v: "warn", label: "30日以内" },
                { v: "stale", label: "30日超" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                onClick={() => setActivity(o.v)}
                className={`px-3 py-1 text-sm rounded-full transition ${
                  activity === o.v
                    ? "bg-brand-500 text-white"
                    : "bg-ink-800 text-gray-300 hover:bg-ink-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg p-6 border border-brand-100 text-gray-600 text-sm">
          {items.length === 0
            ? "まだお客様が登録されていません。「+ 新規追加」から登録してください。"
            : "条件に一致するお客様はいません。"}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => {
            const initial = c.name.slice(0, 1);
            const s = staleness(c.last_report_date);
            const staleColors: Record<typeof s, string> = {
              fresh: "bg-green-50 text-green-700 border-green-200",
              warn: "bg-yellow-50 text-yellow-700 border-yellow-200",
              stale: "bg-gray-50 text-gray-600 border-gray-200",
            };
            return (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="flex items-center gap-4 bg-white rounded-lg border border-brand-100 hover:border-brand-500 px-4 py-3 transition"
                >
                  <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 font-semibold text-lg flex items-center justify-center flex-shrink-0">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink-900">
                        {c.name}
                      </span>
                      {c.tone_memo && (
                        <span className="text-xs text-gray-500 truncate">
                          / {c.tone_memo}
                        </span>
                      )}
                    </div>
                    {c.goal && (
                      <div className="text-sm text-gray-600 truncate">
                        目標: {c.goal}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div
                      className={`inline-block text-xs px-2 py-0.5 rounded border ${staleColors[s]}`}
                    >
                      最終: {relDays(c.last_report_date)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      履歴 {c.report_count} 件
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
