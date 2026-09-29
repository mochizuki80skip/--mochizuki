import { prisma } from "@/lib/prisma";
import { THEMES } from "@/lib/themes";
import { previewStores } from "@/lib/storeData";
import { BatchFields } from "@/components/BatchFields";
import { createBatchAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewBatchPage({ searchParams }: { searchParams: Promise<{ theme?: string }> }) {
  const { theme = "" } = await searchParams;
  const tomorrow = new Date(Date.now() + 9 * 3600_000 + 86400_000).toISOString().slice(0, 10);
  const [{ stores, customKeys }, report] = await Promise.all([
    previewStores(),
    prisma.analysisReport.findFirst({ where: { status: "done" }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">投稿を個別に作成</h1>
      <p className="text-sm text-gray-500">
        キャンペーン・休診のお知らせや、院名・地名だけ変えて全店舗に同じ内容を出したいときに使います。
      </p>
      <form action={createBatchAction} className="bg-white border rounded p-4 space-y-4">
        <BatchFields
          d={{ theme, memo: "", mode: theme ? "ai" : "template", gbpTemplate: "", igTemplate: "", mediaType: "image", headline: "", bgPrompt: "" }}
          stores={stores}
          customKeys={customKeys}
          themeIdeas={[...(report?.themeIdeas ?? []), ...THEMES]}
        />
        <label className="block text-sm font-medium">
          全店舗共通の写真 URL（任意。未入力なら各店舗の写真を背景に使用）
          <input name="imageUrl" type="url" className="mt-1 w-full border rounded px-3 py-2 text-sm font-normal" />
        </label>
        <div className="flex gap-3">
          <label className="block text-sm font-medium">
            投稿日
            <input name="date" type="date" defaultValue={tomorrow} required className="mt-1 border rounded px-3 py-2 text-sm font-normal" />
          </label>
          <label className="block text-sm font-medium">
            時刻
            <input name="time" type="time" defaultValue="10:00" required className="mt-1 border rounded px-3 py-2 text-sm font-normal" />
          </label>
        </div>
        <button className="bg-brand text-white px-4 py-2 rounded text-sm">作成して確認画面へ</button>
      </form>
    </div>
  );
}
