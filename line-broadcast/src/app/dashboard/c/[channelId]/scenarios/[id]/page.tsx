import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cumulativeLabels } from "@/lib/scenario-labels";
import type { BlockInput } from "@/lib/campaign-blocks";
import { ScenarioForm } from "../ScenarioForm";

export const dynamic = "force-dynamic";

// 保存済みのブロック定義。無い（旧データ）場合は LINE 形式のテキストから復元する
function stepBlocks(blocks: unknown, messages: unknown): BlockInput[] {
  if (Array.isArray(blocks) && blocks.length > 0) return blocks as BlockInput[];
  const texts = (messages as Array<{ type: string; text?: string }>)
    .filter((m) => m.type === "text")
    .map((m) => ({ type: "text" as const, text: m.text ?? "" }));
  return texts.length > 0 ? texts : [{ type: "text", text: "" }];
}

export default async function EditScenario({
  params,
}: {
  params: Promise<{ channelId: string; id: string }>;
}) {
  const { channelId, id } = await params;
  const [scenario, tags] = await Promise.all([
    prisma.scenario.findFirst({
      where: { id, lineChannelId: channelId },
      include: { steps: { orderBy: { order: "asc" } }, runs: { select: { status: true } } },
    }),
    prisma.tag.findMany({ where: { lineChannelId: channelId }, orderBy: { name: "asc" } }),
  ]);
  if (!scenario) notFound();

  // ステップごとの送信状況
  const grouped = await prisma.scenarioRunStep.groupBy({
    by: ["stepId", "status"],
    where: { stepId: { in: scenario.steps.map((s) => s.id) } },
    _count: { _all: true },
  });
  const count = (stepId: string, status: string) =>
    grouped.find((g) => g.stepId === stepId && g.status === status)?._count._all ?? 0;
  const labels = cumulativeLabels(scenario.steps);
  const running = scenario.runs.filter((r) => r.status === "running").length;
  const done = scenario.runs.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">ステップ配信 / 編集</h1>

      <section className="bg-white border rounded p-5 max-w-4xl">
        <h2 className="font-semibold mb-1">進行状況</h2>
        <p className="text-sm text-gray-600 mb-3">
          開始した人：<b>{scenario.runs.length}</b> 人（進行中 {running} ／ 完了 {done}）
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">ステップ</th>
                <th className="px-3 py-2 font-medium">送る時期</th>
                <th className="px-3 py-2 font-medium">送信済</th>
                <th className="px-3 py-2 font-medium">送信待ち</th>
                <th className="px-3 py-2 font-medium">失敗/スキップ</th>
              </tr>
            </thead>
            <tbody>
              {scenario.steps.map((s, i) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2">ステップ {i + 1}</td>
                  <td className="px-3 py-2 text-gray-600">{labels[i]}</td>
                  <td className="px-3 py-2">{count(s.id, "sent")}</td>
                  <td className="px-3 py-2">{count(s.id, "pending")}</td>
                  <td className="px-3 py-2">{count(s.id, "failed") + count(s.id, "skipped")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">「スキップ」は、送信前にブロックされた友だちなどです。</p>
      </section>

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
            sendTime: s.sendTime,
            blocks: stepBlocks(s.blocks, s.messages),
          })),
        }}
      />
    </div>
  );
}
