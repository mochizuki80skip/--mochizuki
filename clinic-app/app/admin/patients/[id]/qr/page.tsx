import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/guards";
import { getPatientById } from "@/lib/db";
import { getBaseUrl } from "@/lib/baseUrl";
import PatientQRCode from "@/components/PatientQRCode";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function PatientQRPrintPage({
  params,
}: {
  params: { id: string };
}) {
  requireAdmin();
  const patient = await getPatientById(params.id);
  if (!patient) notFound();

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/me?chart=${encodeURIComponent(patient.chart_number)}&name=${encodeURIComponent(patient.name)}`;

  return (
    <main className="mx-auto max-w-2xl px-5 py-8 print:p-0 print:max-w-full">
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Link
          href={`/admin/patients/${patient.id}`}
          className="text-xs text-ink-400 hover:text-ink-700 tracking-widest"
        >
          ← 戻る
        </Link>
        <PrintButton className="ml-auto rounded-full bg-ink-900 text-white font-bold text-sm px-5 py-2.5 hover:bg-ink-700 transition" />
      </div>

      {/* Welcome card — A6/postcard sized, designed for monochrome print too */}
      <article className="mx-auto max-w-md rounded-2xl border-2 border-ink-900 bg-white p-8 shadow-soft print:shadow-none print:border-2">
        <div className="text-center">
          <div className="flex justify-center mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/logo-full.png"
              alt="リカバリー鍼灸院"
              className="w-32 h-auto"
            />
          </div>
          <h1 className="text-xl font-black text-ink-900 leading-tight">
            あなた専用のマイページ
          </h1>
          <p className="text-xs text-ink-500 mt-1.5 leading-relaxed">
            体質診断の履歴をいつでも確認できます
          </p>
        </div>

        <div className="my-6 flex justify-center">
          <PatientQRCode url={url} size={196} />
        </div>

        <div className="rounded-xl bg-ink-50 px-4 py-3 mb-4">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <span className="text-ink-400">カルテ番号</span>
            <span className="font-bold text-ink-900 tabular-nums">
              {patient.chart_number}
            </span>
            <span className="text-ink-400">お名前</span>
            <span className="font-bold text-ink-900">{patient.name}</span>
          </div>
        </div>

        <ol className="text-xs text-ink-700 leading-relaxed space-y-1.5">
          <li>
            <span className="font-bold text-accent-600">①</span>{" "}
            スマホのカメラでQRコードを読み込みます
          </li>
          <li>
            <span className="font-bold text-accent-600">②</span>{" "}
            自動でマイページが開きます（カルテ番号・お名前は入力済み）
          </li>
          <li>
            <span className="font-bold text-accent-600">③</span>{" "}
            ホーム画面に追加すると次回からアプリのように開けます
          </li>
        </ol>

        <p className="text-[10px] text-ink-400 text-center mt-5 break-all">
          {url}
        </p>
      </article>
    </main>
  );
}
