import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePatient } from "@/lib/guards";
import { getDiagnosis } from "@/lib/db";
import DiagnosisDetail from "@/components/DiagnosisDetail";
import PatientHeader from "../../PatientHeader";

export const dynamic = "force-dynamic";

export default async function MyDiagnosisDetail({
  params,
}: {
  params: { diagId: string };
}) {
  const patient = await requirePatient();
  const row = await getDiagnosis(params.diagId);
  if (!row || row.patient_id !== patient.id) notFound();

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12">
      <PatientHeader />
      <div className="mb-3">
        <Link
          href="/me/dashboard"
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← マイページに戻る
        </Link>
      </div>
      <DiagnosisDetail row={row} />
    </main>
  );
}
