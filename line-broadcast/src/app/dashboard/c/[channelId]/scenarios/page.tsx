import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, listAccessibleChannels } from "@/lib/permissions";
import { TRIGGER_LABEL, cumulativeLabels } from "@/lib/scenario-labels";
import { RowActions } from "./RowActions";

export const dynamic = "force-dynamic";

export default async function ScenariosPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  const user = await getCurrentUser();
  const [scenarios, channels, overdue] = await Promise.all([
    prisma.scenario.findMany({
      where: { lineChannelId: channelId },
      orderBy: { createdAt: "desc" },
      include: { steps: { orderBy: { order: "asc" } }, runs: { select: { status: true } } },
    }),
    user ? listAccessibleChannels(user.id, user.role) : Promise.resolve([]),
    // 送信予定を 10 分以上過ぎても未送信のステップ = cron が動いていない可能性
    prisma.scenarioRunStep.count({
      where: {
        status: "pending",
        scheduledAt: { lt: new Date(Date.now() - 10 * 60_000) },
        run: { friend: { lineChannelId: channelId } },
      },
    }),
  ]);
  const tagIds = scenarios.map((s) => s.triggerTagId).filter((x): x is string => !!x);
  const tags = await prisma.tag.findMany({ where: { id: { in: tagIds } } });
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const others = channels.filter((c) => c.id !== channelId).map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">ステップ配信</h1>
        <Link href={`/dashboard/c/${channelId}/scenarios/new`} className="bg-line text-white px-3 py-1.5 rounded text-sm">
          新規作成
        </Link>
      </div>

      <div className="bg-line-light border border-line/30 rounded p-4 text-sm space-y-1">
        <div className="font-medium">ステップ配信とは</div>
        <p className="text-gray-700">
          「友だち追加された」「タグが付いた」を<b>きっかけ</b>に、あらかじめ決めたメッセージを<b>自動で順番に</b>届ける機能です。
          例：追加の直後にごあいさつ → 翌日の 10:00 に来院のお礼 → 1 週間後に次回予約のご案内。
        </p>
        <p className="text-xs text-gray-500">
          ※ 有効にした以降にきっかけが起きた人から開始されます（すでに友だちの人には送られません）。送信は 1 分間隔の定期実行（cron）で行われます。
        </p>
      </div>

      {overdue > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          送信予定を過ぎても未送信のメッセージが {overdue} 件あります。定期実行（/api/cron/dispatch）が動いているか確認してください。
        </div>
      )}

      <div className="space-y-3">
        {scenarios.map((s) => {
          const running = s.runs.filter((r) => r.status === "running").length;
          const done = s.runs.filter((r) => r.status === "completed").length;
          const trigger =
            s.triggerType === "tag_added"
              ? `タグ「${tagName.get(s.triggerTagId ?? "") ?? "（削除済み）"}」が付いたとき`
              : `${TRIGGER_LABEL[s.triggerType] ?? s.triggerType}されたとき`;
          const labels = cumulativeLabels(s.steps);
          return (
            <div key={s.id} className="bg-white border rounded p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/dashboard/c/${channelId}/scenarios/${s.id}`} className="font-medium text-line-dark hover:underline">
                    {s.name}
                  </Link>
                  <span className={`ml-2 text-xs rounded px-2 py-0.5 ${s.isActive ? "bg-line-light text-line-dark" : "bg-gray-100 text-gray-500"}`}>
                    {s.isActive ? "有効" : "無効"}
                  </span>
                  <div className="text-xs text-gray-500 mt-1">開始：{trigger}</div>
                </div>
                <div className="text-xs text-gray-600 text-right">
                  進行中 <b>{running}</b> 人 ／ 完了 <b>{done}</b> 人
                </div>
              </div>
              <ol className="flex flex-wrap gap-2 text-xs">
                {s.steps.map((st, i) => (
                  <li key={st.id} className="border rounded px-2 py-1 bg-gray-50">
                    <span className="text-gray-500">{labels[i]}</span>
                    <span className="mx-1">→</span>
                    {previewText(st.messages)}
                  </li>
                ))}
              </ol>
              <div className="flex items-start justify-between gap-3">
                <Link href={`/dashboard/c/${channelId}/scenarios/${s.id}`} className="text-sm text-line-dark hover:underline">
                  編集・進行状況
                </Link>
                <div className="flex-1 max-w-md">
                  <RowActions channelId={channelId} scenarioId={s.id} isActive={s.isActive} otherChannels={others} />
                </div>
              </div>
            </div>
          );
        })}
        {scenarios.length === 0 && (
          <div className="bg-white border rounded p-6 text-sm text-gray-500">
            ステップ配信はまだありません。「新規作成」から、サンプル入りで試せます。
          </div>
        )}
      </div>
    </div>
  );
}

function previewText(messages: unknown): string {
  const m = (messages as Array<{ type: string; text?: string }>)?.[0];
  if (!m) return "";
  const label = m.type === "text" ? (m.text ?? "") : ({ image: "[画像]", imagemap: "[リッチメッセージ]", flex: "[カード]" } as Record<string, string>)[m.type] ?? "";
  return label.length > 14 ? `${label.slice(0, 14)}…` : label;
}
