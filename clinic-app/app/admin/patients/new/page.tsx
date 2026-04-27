import { requireAdmin } from "@/lib/guards";
import { getClinic } from "@/lib/clinics";
import AdminHeader from "../../AdminHeader";
import NewPatientForm from "./NewPatientForm";

export const dynamic = "force-dynamic";

export default function NewPatientPage() {
  const ctx = requireAdmin();
  const fixedClinic =
    ctx.role === "master" ? null : getClinic(ctx.clinicId);

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12 fade-up">
      <AdminHeader role={ctx.role} />
      <h1 className="text-[22px] font-black text-ink-900 mb-1">
        患者の新規登録
      </h1>
      <p className="text-xs text-ink-500 mb-6">
        カルテ番号と氏名は必須です。番号は院ごとに独立しているため、両院で同じ番号を使えます。
      </p>
      <NewPatientForm
        masterMode={ctx.role === "master"}
        fixedClinicId={fixedClinic?.id || null}
        fixedClinicName={fixedClinic?.name || null}
      />
    </main>
  );
}
