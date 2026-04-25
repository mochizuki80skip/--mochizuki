import Link from "next/link";
import { requireAdmin } from "@/lib/guards";
import {
  getDashboardStats,
  getLatestDiagnosisDateMap,
  listPatients,
} from "@/lib/db";
import AdminHeader from "./AdminHeader";
import PatientList from "./PatientList";
import Dashboard from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  requireAdmin();

  const [patients, stats] = await Promise.all([
    listPatients(),
    getDashboardStats(),
  ]);
  const latestMap = await getLatestDiagnosisDateMap(patients.map((p) => p.id));

  return (
    <main className="mx-auto max-w-2xl px-5 pt-6 pb-12 fade-up">
      <AdminHeader />

      <Dashboard stats={stats} />

      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-[20px] font-black text-ink-900">患者一覧</h1>
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
        <PatientList patients={patients} latestMap={latestMap} />
      )}
    </main>
  );
}
