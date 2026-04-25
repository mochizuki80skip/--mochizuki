import Link from "next/link";
import { getAuthenticatedPatientId } from "@/lib/auth";
import { getPatientById } from "@/lib/db";
import { redirect } from "next/navigation";
import VerifyForm from "./VerifyForm";

export const dynamic = "force-dynamic";

export default async function MeEntry({
  searchParams,
}: {
  searchParams: { chart?: string };
}) {
  // Already verified? jump to dashboard.
  const id = getAuthenticatedPatientId();
  if (id) {
    const p = await getPatientById(id);
    if (p) redirect("/me/dashboard");
  }

  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-12 fade-up">
      <header className="flex items-center gap-2 mb-10">
        <Link href="/" className="text-ink-500 text-sm tracking-widest">
          ← TOP
        </Link>
        <span className="ml-auto text-[10px] tracking-[0.2em] text-ink-400">
          PATIENT
        </span>
      </header>

      <h1 className="text-[22px] font-black text-ink-900 mb-2">
        通院中の方
      </h1>
      <p className="text-sm text-ink-500 mb-8 leading-relaxed">
        院から発行されたカルテ番号と氏名を入力してください。
        過去の体質診断履歴をいつでも確認できます。
      </p>

      <VerifyForm initialChartNumber={searchParams.chart || ""} />

      <div className="mt-10 rounded-xl border border-dashed border-ink-200 p-4 text-xs text-ink-500 leading-relaxed">
        <p className="font-bold text-ink-700 mb-1">カルテ番号がわからない方</p>
        <p>院でお伝えしている番号です。不明な場合は受付にお問い合わせください。</p>
      </div>
    </main>
  );
}
