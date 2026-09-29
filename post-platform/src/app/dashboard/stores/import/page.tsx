import { prisma } from "@/lib/prisma";
import { ImportList } from "./ImportList";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const existing = await prisma.store.findMany({ select: { gbpLocationId: true } });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Google から店舗を取り込む</h1>
      <p className="text-sm text-gray-500">
        連携した Google アカウントで管理している全店舗を表示します。店舗名・カテゴリから接骨院と思われる店舗に最初からチェックを入れているので、確認して取り込んでください。
      </p>
      <ImportList existing={existing.map((e) => e.gbpLocationId).filter(Boolean) as string[]} />
    </div>
  );
}
