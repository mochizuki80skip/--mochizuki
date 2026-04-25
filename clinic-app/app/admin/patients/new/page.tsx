import { requireAdmin } from "@/lib/guards";
import AdminHeader from "../../AdminHeader";
import NewPatientForm from "./NewPatientForm";

export const dynamic = "force-dynamic";

export default function NewPatientPage() {
  requireAdmin();

  return (
    <main className="mx-auto max-w-md px-5 pt-6 pb-12 fade-up">
      <AdminHeader />
      <h1 className="text-[22px] font-black text-ink-900 mb-1">
        患者の新規登録
      </h1>
      <p className="text-xs text-ink-500 mb-6">
        カルテ番号と氏名は必須です。番号は院の番号体系に合わせて自由に設定できます。
      </p>
      <NewPatientForm />
    </main>
  );
}
