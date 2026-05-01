"use client";

import { useState } from "react";
import type { ChartComment } from "@/lib/types";

const ROLE_LABEL: Record<ChartComment["author_role"], string> = {
  master: "院長",
  main: "本院",
  branch: "分院",
};
const ROLE_COLOR: Record<ChartComment["author_role"], string> = {
  master: "bg-rose-100 text-rose-700",
  main: "bg-sky-100 text-sky-700",
  branch: "bg-emerald-100 text-emerald-700",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type Props = {
  chartId: string;
  initialComments: ChartComment[];
  /** 現在のスタッフのロール — 自分の投稿は削除UIを表示 */
  currentRole: ChartComment["author_role"];
};

export default function CommentThread({
  chartId,
  initialComments,
  currentRole,
}: Props) {
  const [comments, setComments] = useState<ChartComment[]>(initialComments);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!body.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/charts/${chartId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!res.ok || !json.comment) {
        throw new Error(json.error || "post failed");
      }
      setComments((prev) => [...prev, json.comment]);
      setBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信に失敗しました");
    } finally {
      setPosting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("このコメントを削除しますか？")) return;
    const res = await fetch(`/api/admin/charts/${chartId}/comments/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    } else {
      alert("削除に失敗しました");
    }
  }

  const canDelete = (c: ChartComment) =>
    currentRole === "master" || c.author_role === currentRole;

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft">
      <h2 className="text-xs tracking-widest text-ink-400 mb-3 font-bold">
        💬 スタッフコメント ({comments.length})
      </h2>

      {comments.length === 0 ? (
        <p className="text-xs text-ink-400 text-center py-3">
          まだコメントはありません
        </p>
      ) : (
        <ol className="space-y-2.5 mb-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-ink-100 bg-ink-50 p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={[
                    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest",
                    ROLE_COLOR[c.author_role],
                  ].join(" ")}
                >
                  {ROLE_LABEL[c.author_role]}
                </span>
                <span className="text-[10px] text-ink-400 tabular-nums">
                  {formatDateTime(c.created_at)}
                </span>
                {canDelete(c) && (
                  <button
                    onClick={() => remove(c.id)}
                    className="ml-auto text-[10px] text-ink-400 hover:text-rose-600 transition"
                  >
                    削除
                  </button>
                )}
              </div>
              <p className="text-sm text-ink-800 leading-relaxed whitespace-pre-wrap">
                {c.body}
              </p>
            </li>
          ))}
        </ol>
      )}

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="コメントを入力（次回担当への申し送り、観察メモなど）"
          className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-accent"
          disabled={posting}
        />
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button
          onClick={submit}
          disabled={posting || !body.trim()}
          className="w-full rounded-full bg-ink-900 text-white font-bold text-sm py-2.5 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ink-700 transition"
        >
          {posting ? "送信中…" : "コメントを投稿"}
        </button>
      </div>
    </div>
  );
}
