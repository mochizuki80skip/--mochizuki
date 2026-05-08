import Link from "next/link";
import { contentForType } from "@/lib/content";
import type { DashboardStats } from "@/lib/db";

export default function Dashboard({ stats }: { stats: DashboardStats }) {
  const typeEntries = Object.entries(stats.typeDistribution).sort(
    (a, b) => b[1] - a[1],
  );
  const typedTotal = typeEntries.reduce((s, [, n]) => s + n, 0);

  return (
    <section className="space-y-3 mb-6">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="登録患者" value={stats.totalPatients} unit="名" />
        <Stat
          label="今月の診断"
          value={stats.diagnosesThisMonth}
          unit="件"
        />
        <Stat
          label="60日以上 未来院"
          value={stats.staleCount}
          unit="名"
          tone={stats.staleCount > 0 ? "warn" : "default"}
        />
      </div>

      {stats.todaysBirthdays.length > 0 && (
        <div className="rounded-xl border border-accent bg-accent-50 px-4 py-3">
          <div className="text-[10px] tracking-widest text-accent-600 font-bold mb-1">
            今日が誕生日
          </div>
          <ul className="space-y-0.5">
            {stats.todaysBirthdays.map((p) => (
              <li key={p.id} className="text-sm">
                <Link
                  href={`/admin/patients/${p.id}`}
                  className="text-ink-900 font-bold hover:text-accent-600"
                >
                  {p.chart_number} {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {typedTotal > 0 && (
        <details className="rounded-xl border border-ink-100 bg-white p-3 shadow-soft">
          <summary className="cursor-pointer text-xs tracking-widest text-ink-400 font-bold">
            タイプ別 患者分布
          </summary>
          <ul className="mt-3 space-y-2">
            {typeEntries.map(([key, count]) => {
              const c = contentForType(
                key as Parameters<typeof contentForType>[0],
              );
              const pct = Math.round((count / typedTotal) * 100);
              return (
                <li key={key}>
                  <div className="flex items-baseline gap-2 text-xs mb-1">
                    <span className="font-bold text-ink-900">{c.name}</span>
                    <span className="ml-auto text-ink-400 tabular-nums">
                      {count}名 ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                    <div
                      className="h-full bg-accent"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  tone = "default",
}: {
  label: string;
  value: number;
  unit: string;
  tone?: "default" | "warn";
}) {
  return (
    <div
      className={[
        "rounded-xl border px-3 py-3 shadow-soft text-center",
        tone === "warn"
          ? "border-rose-200 bg-rose-50"
          : "border-ink-100 bg-white",
      ].join(" ")}
    >
      <div className="text-[10px] tracking-widest text-ink-400 leading-tight">
        {label}
      </div>
      <div
        className={[
          "text-2xl font-black tabular-nums leading-tight mt-0.5",
          tone === "warn" ? "text-rose-600" : "text-ink-900",
        ].join(" ")}
      >
        {value}
      </div>
      <div className="text-[10px] text-ink-400">{unit}</div>
    </div>
  );
}
