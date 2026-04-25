import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/guards";
import { getDiagnosis, getPatientById } from "@/lib/db";
import DiagnosisDetail from "@/components/DiagnosisDetail";
import AdminHeader from "../../../../AdminHeader";

export const dynamic = "force-dynamic";

export default async function DiagnosisAdminDetailPage({
  params,
}: {
  params: { id: string; diagId: string };
}) {
  requireAdmin();

  const [patient, row] = await Promise.all([
    getPatientById(params.id),
    getDiagnosis(params.diagId),
  ]);
  if (!patient || !row || row.patient_id !== patient.id) notFound();

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12">
      <AdminHeader />
      <div className="mb-3">
        <Link
          href={`/admin/patients/${patient.id}`}
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← {patient.chart_number} {patient.name}
        </Link>
      </div>
      <DiagnosisDetail row={row} />
    </main>
  );
}
