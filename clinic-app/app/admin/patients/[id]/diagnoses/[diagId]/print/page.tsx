import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAccessPatient, requireAdmin } from "@/lib/guards";
import { getPatientById, listDiagnosesForPatient } from "@/lib/db";
import PrintableDiagnosis from "@/components/PrintableDiagnosis";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function AdminDiagnosisPrint({
  params,
}: {
  params: { id: string; diagId: string };
}) {
  const ctx = requireAdmin();
  const patient = await getPatientById(params.id);
  if (!patient) notFound();
  if (!canAccessPatient(patient, ctx)) redirect("/admin/forbidden");
  const diagnoses = await listDiagnosesForPatient(patient.id);
  const row = diagnoses.find((d) => d.id === params.diagId);
  if (!row) notFound();
  // For comparison: pick the diagnosis immediately before this one (chronological).
  const sorted = [...diagnoses].sort(
    (a, b) =>
      new Date(a.diagnosed_at).getTime() -
      new Date(b.diagnosed_at).getTime(),
  );
  const idx = sorted.findIndex((d) => d.id === row.id);
  const compare = idx > 0 ? sorted[idx - 1] : null;

  return (
    <main>
      <div className="mx-auto max-w-2xl px-5 py-4 flex items-center gap-3 print:hidden">
        <Link
          href={`/admin/patients/${patient.id}/diagnoses/${row.id}`}
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← 戻る
        </Link>
        <PrintButton className="ml-auto rounded-full bg-ink-900 text-white font-bold text-sm px-5 py-2.5 hover:bg-ink-700 transition" />
      </div>
      <PrintableDiagnosis row={row} patient={patient} compare={compare} />
    </main>
  );
}
