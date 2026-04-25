import Link from "next/link";
import { requireAdmin } from "@/lib/guards";
import { getLatestDiagnosisDateMap, listPatients } from "@/lib/db";
import AdminHeader from "./AdminHeader";

export const dynamic = "force-dynamic";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AdminHome() {
  requireAdmin();

  const patients = await listPatients();
  const latestMap = await getLatestDiagnosisDateMap(patients.map((p) => p.id));

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-12 fade-up">
      <AdminHeader />

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[22px] font-black text-ink-900">患者一覧</h1>
          <p className="text-xs text-ink-500 mt-0.5">
            登録患者数 {patients.length} 名
          </p>
        </div>
        <Link
          href="/admin/patients/new"
          className="rounded-full bg-accent text-ink-900 font-bold text-sm px-4 py-2.5 shadow-soft hover:bg-accent-400 transition"
        >
          ＋ 新規登録
        </Link>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 p-8 text-center text-ink-500">
          <p className="text-sm">まだ患者が登録されていません。</p>
          <Link
            href="/admin/patients/new"
            className="inline-block mt-4 text-accent-600 font-bold text-sm"
          >
            最初の患者を登録する →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {patients.map((p) => {
            const latest = latestMap[p.id];
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
                      <div className="text-xs text-ink-700 tabular-nums">
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
    </main>
  );
}
