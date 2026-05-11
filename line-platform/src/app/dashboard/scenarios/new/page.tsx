import { prisma } from "@/lib/prisma";
import { ScenarioForm } from "../ScenarioForm";

export const dynamic = "force-dynamic";

export default async function NewScenario() {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">ステップ配信 / 新規作成</h1>
      <ScenarioForm tags={tags.map((t) => ({ id: t.id, name: t.name }))} />
    </div>
  );
}
