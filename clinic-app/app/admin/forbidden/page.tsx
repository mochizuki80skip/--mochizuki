import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AdminForbiddenPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-12 pb-12 fade-up text-center">
      <div className="text-[10px] tracking-[0.3em] text-rose-600 font-bold mb-2">
        ACCESS DENIED
      </div>
      <h1 className="text-[22px] font-black text-ink-900 mb-3">
        この患者にはアクセスできません
      </h1>
      <p className="text-sm text-ink-500 leading-relaxed mb-8">
        他院の患者の情報は閲覧・編集できません。
        <br />
        間違いと思われる場合は、院長（Master）にお問い合わせください。
      </p>
      <Link
        href="/admin"
        className="inline-block rounded-full bg-accent text-ink-900 font-bold text-sm px-5 py-2.5 shadow-soft hover:bg-accent-400 transition"
      >
        患者一覧に戻る
      </Link>
    </main>
  );
}
