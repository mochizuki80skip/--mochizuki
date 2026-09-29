import { prisma } from "@/lib/prisma";
import { AutoReplyManager } from "./AutoReplyManager";

export const dynamic = "force-dynamic";

export default async function AutoRepliesPage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params;
  const rules = await prisma.autoReply.findMany({
    where: { lineChannelId: channelId },
    orderBy: { createdAt: "asc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">自動応答</h1>
      <div className="bg-line-light border border-line/30 rounded p-4 text-sm text-gray-700 space-y-1">
        <div className="font-medium text-line-dark">送信通数にカウントされない返信です</div>
        <div>
          友だちが送ったメッセージ、またはリッチメニュー等のポストバック（data）がキーワードに一致すると、
          応答メッセージ（replyToken）で返信します。一斉配信・ステップ配信の push と違い、月間の送信枠を消費しません。
        </div>
        <div className="text-xs text-gray-500">
          ※ LINE Official Account Manager 側の「応答メッセージ」を有効にしていると二重に返信されるため、こちらを使う場合は Manager 側をオフにしてください。
        </div>
      </div>
      <AutoReplyManager
        channelId={channelId}
        initial={rules.map((r) => {
          const first = (r.messages as { type?: string; text?: string }[])[0];
          return {
            id: r.id,
            keyword: r.keyword,
            matchType: r.matchType,
            isActive: r.isActive,
            preview: first?.type === "text" ? first.text ?? "" : `(${first?.type ?? "message"})`,
          };
        })}
      />
    </div>
  );
}
