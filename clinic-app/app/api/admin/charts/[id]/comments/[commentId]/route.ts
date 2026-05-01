import { NextResponse } from "next/server";
import { deleteChartComment, listCommentsForChart } from "@/lib/db";
import { requireAdmin } from "@/lib/guards";

export const runtime = "nodejs";

/**
 * コメント削除。
 * 投稿者本人 (author_role === ctx.role) または master のみ削除可。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; commentId: string } },
) {
  const ctx = requireAdmin();
  const list = await listCommentsForChart(params.id);
  const target = list.find((c) => c.id === params.commentId);
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (ctx.role !== "master" && target.author_role !== ctx.role) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  await deleteChartComment(params.commentId);
  return NextResponse.json({ ok: true });
}
