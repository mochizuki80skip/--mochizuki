import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtJst } from "@/lib/themes";
import { CreateWeekButton } from "./CreateWeekButton";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  pending: "AI作成待ち",
  draft: "確認待ち",
  approved: "承認済み",
  posted: "投稿済み",
  failed: "失敗",
  skipped: "見送り",
};
const COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  draft: "bg-amber-100 text-amber-800",
  approved: "bg-blue-100 text-blue-800",
  posted: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-gray-100 text-gray-400",
};

export default async function DashboardPage() {
  const since = new Date(Date.now() - 7 * 86400_000);
  const [batches, conn, storeCount] = await Promise.all([
    prisma.postBatch.findMany({
      where: { scheduledAt: { gte: since } },
      orderBy: { scheduledAt: "asc" },
      include: { posts: { select: { status: true } } },
    }),
    prisma.googleConnection.findUnique({ where: { id: "default" } }),
    prisma.store.count({ where: { isActive: true } }),
  ]);

  const needsReview = batches.reduce((n, b) => n + b.posts.filter((p) => p.status === "draft").length, 0);
  const failed = batches.reduce((n, b) => n + b.posts.filter((p) => p.status === "failed").length, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">投稿予定・承認</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/batches/new" className="border px-3 py-1.5 rounded text-sm bg-white">
            個別に作成
          </Link>
          <CreateWeekButton />
        </div>
      </div>

      {!conn && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded p-3 text-sm">
          Google アカウントが未連携です。<Link href="/dashboard/settings" className="underline">設定</Link>から連携してください。
        </div>
      )}
      {storeCount === 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded p-3 text-sm">
          投稿対象の店舗がありません。<Link href="/dashboard/stores" className="underline">店舗</Link>から接骨院を取り込んでください。
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Stat label="投稿対象の店舗" value={storeCount} />
        <Stat label="確認待ち" value={needsReview} tone={needsReview ? "amber" : undefined} />
        <Stat label="失敗" value={failed} tone={failed ? "red" : undefined} />
      </div>

      <div className="bg-white border rounded divide-y">
        {batches.length === 0 && (
          <div className="p-6 text-sm text-gray-500">予定はありません。「翌週分を作成」で投稿曜日ぶんの回が作成されます。</div>
        )}
        {batches.map((b) => {
          const counts = b.posts.reduce<Record<string, number>>((m, p) => ((m[p.status] = (m[p.status] ?? 0) + 1), m), {});
          return (
            <Link key={b.id} href={`/dashboard/batches/${b.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-gray-50">
              <div className="w-36 shrink-0 font-medium">{fmtJst(b.scheduledAt)}</div>
              <div className="flex-1 min-w-40 text-sm">{b.theme}</div>
              <div className="flex flex-wrap gap-1">
                {Object.entries(counts).map(([s, n]) => (
                  <span key={s} className={`text-xs px-2 py-0.5 rounded ${COLOR[s]}`}>
                    {LABEL[s]} {n}
                  </span>
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" | "red" }) {
  const c = tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-600" : "";
  return (
    <div className="bg-white border rounded p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${c}`}>{value}</div>
    </div>
  );
}
