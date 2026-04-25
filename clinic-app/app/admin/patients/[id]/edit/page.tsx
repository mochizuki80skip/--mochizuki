import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/guards";
import { getPatientById } from "@/lib/db";
import AdminHeader from "../../../AdminHeader";
import EditPatientForm from "./EditPatientForm";

export const dynamic = "force-dynamic";

export default async function EditPatientPage({
  params,
}: {
  params: { id: string };
}) {
  requireAdmin();
  const patient = await getPatientById(params.id);
  if (!patient) notFound();

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12 fade-up">
      <AdminHeader />
      <div className="mb-3">
        <Link
          href={`/admin/patients/${patient.id}`}
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← {patient.chart_number} {patient.name}
        </Link>
      </div>

      <h1 className="text-[22px] font-black text-ink-900 mb-1">
        患者情報の編集
      </h1>
      <p className="text-xs text-ink-500 mb-6">
        変更後は「保存」をタップしてください。診断履歴は影響を受けません。
      </p>

      <EditPatientForm patient={patient} />
    </main>
  );
}
