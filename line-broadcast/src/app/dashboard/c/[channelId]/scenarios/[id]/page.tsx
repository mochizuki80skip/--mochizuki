import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ScenarioForm } from "../ScenarioForm";

export const dynamic = "force-dynamic";

export default async function EditScenario({
  params,
}: {
  params: Promise<{ channelId: string; id: string }>;
}) {
  const { channelId, id } = await params;
  const [scenario, tags] = await Promise.all([
    prisma.scenario.findFirst({
      where: { id, lineChannelId: channelId },
      include: { steps: { orderBy: { order: "asc" } } },
    }),
    prisma.tag.findMany({ where: { lineChannelId: channelId }, orderBy: { name: "asc" } }),
  ]);
  if (!scenario) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">ステップ配信 / 編集</h1>
      <ScenarioForm
        channelId={channelId}
        tags={tags.map((t) => ({ id: t.id, name: t.name }))}
        initial={{
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          triggerType: scenario.triggerType,
          triggerTagId: scenario.triggerTagId,
          isActive: scenario.isActive,
          steps: scenario.steps.map((s) => ({
            delayMinutes: s.delayMinutes,
            messages: s.messages,
          })),
        }}
      />
    </div>
  );
}
