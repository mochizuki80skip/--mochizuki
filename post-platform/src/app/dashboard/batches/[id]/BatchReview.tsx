"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Flag } from "@/lib/compliance";
import {
  approveAction,
  deleteBatchAction,
  generateAction,
  regenerateAction,
  retryAction,
  savePostAction,
  skipAction,
  unapproveAction,
} from "../../actions";

export type ReviewPost = {
  id: string;
  storeName: string;
  storeArea: string;
  channels: { gbp: boolean; instagram: boolean };
  gbpText: string;
  igCaption: string;
  imageUrl: string;
  status: string;
  flags: Flag[];
  error: string | null;
  deliveries: { channel: string; status: string; error: string | null }[];
};

const STATUS: Record<string, [string, string]> = {
  pending: ["AI作成待ち", "bg-gray-100 text-gray-600"],
  draft: ["確認待ち", "bg-amber-100 text-amber-800"],
  approved: ["承認済み", "bg-blue-100 text-blue-800"],
  posted: ["投稿済み", "bg-green-100 text-green-800"],
  failed: ["失敗", "bg-red-100 text-red-700"],
  skipped: ["見送り", "bg-gray-100 text-gray-400"],
};
const CH: Record<string, string> = { gbp: "GBP", instagram: "Instagram" };
const DS: Record<string, string> = { pending: "予約中", sending: "送信中", sent: "投稿済み", failed: "失敗", skipped: "スキップ" };

type Filter = "all" | "draft" | "error" | "approved" | "failed";

export function BatchReview({
  batch,
  posts,
}: {
  batch: { id: string; when: string; theme: string; memo: string; imageUrl: string | null };
  posts: ReviewPost[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const hasErr = (p: ReviewPost) => p.flags.some((f) => f.level === "error");
  const pendingCount = posts.filter((p) => p.status === "pending").length;
  const started = posts.some((p) => p.deliveries.some((d) => d.status === "sent" || d.status === "sending"));
  const approvable = posts.filter((p) => p.status === "draft" && !hasErr(p));
  const shown = useMemo(
    () =>
      posts.filter((p) =>
        filter === "all" ? true : filter === "error" ? hasErr(p) && p.status === "draft" : p.status === filter,
      ),
    [posts, filter],
  );

  function generateAll() {
    start(async () => {
      let remaining = pendingCount;
      while (remaining > 0) {
        setProgress(`AI で作成中…（残り ${remaining} 店舗）`);
        const r = await generateAction(batch.id);
        if (r.processed === 0) break;
        remaining = r.remaining;
        router.refresh();
      }
      setProgress(null);
      router.refresh();
    });
  }

  function approveAll() {
    if (!confirm(`要修正のない ${approvable.length} 店舗の投稿を承認します。予定日時に自動で投稿されます。`)) return;
    start(async () => {
      const r = await approveAction(approvable.map((p) => p.id));
      alert(`${r.approved} 件を承認しました。${r.skipped.length ? `\n承認できなかった店舗：${r.skipped.join("、")}` : ""}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded p-4 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-sm text-gray-500">{batch.when} 投稿</div>
            <h1 className="text-lg font-semibold">{batch.theme}</h1>
            {batch.memo && <div className="text-sm text-gray-600 mt-1">補足：{batch.memo}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingCount > 0 && (
              <button onClick={generateAll} disabled={busy} className="bg-brand text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">
                AI で作成（{pendingCount} 店舗）
              </button>
            )}
            <button
              onClick={approveAll}
              disabled={busy || approvable.length === 0}
              className="bg-green-600 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
            >
              問題なしをまとめて承認（{approvable.length}）
            </button>
            {!started && (
              <button
                onClick={() => confirm("この回を削除しますか？") && start(() => deleteBatchAction(batch.id))}
                disabled={busy}
                className="border px-3 py-1.5 rounded text-sm text-red-600"
              >
                削除
              </button>
            )}
          </div>
        </div>
        {progress && <div className="text-sm text-brand">{progress}</div>}
      </div>

      <div className="flex flex-wrap gap-1 text-sm">
        {(
          [
            ["all", `すべて（${posts.length}）`],
            ["draft", `確認待ち（${posts.filter((p) => p.status === "draft").length}）`],
            ["error", `要修正（${posts.filter((p) => p.status === "draft" && hasErr(p)).length}）`],
            ["approved", `承認済み（${posts.filter((p) => p.status === "approved").length}）`],
            ["failed", `失敗（${posts.filter((p) => p.status === "failed").length}）`],
          ] as [Filter, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1 rounded border ${filter === k ? "bg-brand text-white border-brand" : "bg-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {shown.map((p) => (
          <PostCard key={`${p.id}-${p.status}-${p.gbpText.length}`} post={p} disabled={busy} />
        ))}
      </div>
    </div>
  );
}

function PostCard({ post, disabled }: { post: ReviewPost; disabled: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [gbpText, setGbp] = useState(post.gbpText);
  const [igCaption, setIg] = useState(post.igCaption);
  const [imageUrl, setImage] = useState(post.imageUrl);
  const [flags, setFlags] = useState(post.flags);
  const dirty = gbpText !== post.gbpText || igCaption !== post.igCaption || imageUrl !== post.imageUrl;
  const locked = post.status === "posted" || post.status === "approved" || post.status === "skipped";
  const [label, color] = STATUS[post.status] ?? [post.status, ""];
  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "失敗しました");
      }
    });

  return (
    <div className={`bg-white border rounded p-3 space-y-2 ${flags.some((f) => f.level === "error") ? "border-red-300" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-medium">{post.storeName}</span>
          <span className="text-xs text-gray-500 ml-2">{post.storeArea}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {post.channels.gbp && <span className="px-1.5 rounded bg-gray-100">GBP</span>}
          {post.channels.instagram && <span className="px-1.5 rounded bg-pink-50 text-pink-700">IG</span>}
          <span className={`px-2 py-0.5 rounded ${color}`}>{label}</span>
        </div>
      </div>

      {post.error && <div className="text-xs text-red-600 whitespace-pre-wrap">{post.error}</div>}

      {post.status !== "pending" && (
        <>
          <div className="flex gap-2">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-20 h-20 object-cover rounded border shrink-0" />
            )}
            <label className="text-xs text-gray-500 flex-1">
              画像 URL（Instagram は必須）
              <input
                value={imageUrl}
                onChange={(e) => setImage(e.target.value)}
                disabled={locked}
                className="mt-1 w-full border rounded px-2 py-1 text-xs"
              />
            </label>
          </div>
          <label className="block text-xs text-gray-500">
            GBP（{gbpText.length} 文字）
            <textarea
              value={gbpText}
              onChange={(e) => setGbp(e.target.value)}
              disabled={locked}
              rows={7}
              className="mt-1 w-full border rounded px-2 py-1 text-sm text-gray-900"
            />
          </label>
          {post.channels.instagram && (
            <label className="block text-xs text-gray-500">
              Instagram（{igCaption.length} 文字）
              <textarea
                value={igCaption}
                onChange={(e) => setIg(e.target.value)}
                disabled={locked}
                rows={6}
                className="mt-1 w-full border rounded px-2 py-1 text-sm text-gray-900"
              />
            </label>
          )}
        </>
      )}

      {flags.length > 0 && (
        <ul className="text-xs space-y-1">
          {flags.map((f, i) => (
            <li key={i} className={f.level === "error" ? "text-red-600" : "text-amber-700"}>
              {f.level === "error" ? "要修正" : "注意"}［{CH[f.channel]}］{f.msg}
            </li>
          ))}
        </ul>
      )}

      {post.deliveries.length > 0 && (
        <ul className="text-xs text-gray-600">
          {post.deliveries.map((d) => (
            <li key={d.channel}>
              {CH[d.channel]}：{DS[d.status] ?? d.status}
              {d.error && <span className="text-red-600"> {d.error}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {post.status === "pending" && (
          <button onClick={() => run(() => regenerateAction(post.id))} disabled={busy || disabled} className="border px-2 py-1 rounded text-xs">
            この店舗を AI で作成
          </button>
        )}
        {post.status === "draft" && (
          <>
            <button
              onClick={() =>
                run(async () => setFlags(await savePostAction(post.id, { gbpText, igCaption, imageUrl: imageUrl.trim() || null })))
              }
              disabled={busy || disabled || !dirty}
              className="border px-2 py-1 rounded text-xs disabled:opacity-40"
            >
              保存して再チェック
            </button>
            <button
              onClick={() => run(() => regenerateAction(post.id))}
              disabled={busy || disabled}
              className="border px-2 py-1 rounded text-xs"
            >
              AI で作り直す
            </button>
            <button
              onClick={() =>
                run(async () => {
                  const r = await approveAction([post.id]);
                  if (!r.approved) throw new Error("要修正の項目があるか、未保存の変更があるため承認できません");
                })
              }
              disabled={busy || disabled || dirty || flags.some((f) => f.level === "error")}
              className="bg-green-600 text-white px-2 py-1 rounded text-xs disabled:opacity-40"
            >
              承認
            </button>
            <button onClick={() => run(() => skipAction(post.id))} disabled={busy || disabled} className="px-2 py-1 rounded text-xs text-gray-500">
              今回は見送る
            </button>
          </>
        )}
        {post.status === "approved" && (
          <button onClick={() => run(() => unapproveAction(post.id))} disabled={busy || disabled} className="border px-2 py-1 rounded text-xs">
            承認を取り消す
          </button>
        )}
        {post.status === "failed" && (
          <button onClick={() => run(() => retryAction(post.id))} disabled={busy || disabled} className="border px-2 py-1 rounded text-xs">
            失敗した媒体を再送
          </button>
        )}
      </div>
    </div>
  );
}
