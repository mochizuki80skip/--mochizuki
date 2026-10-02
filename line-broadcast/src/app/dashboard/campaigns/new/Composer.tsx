"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { BlockInput } from "@/lib/campaign-blocks";
import { BlockPreview } from "@/components/message/BlockPreview";
import { MessageEditor, newBlock } from "@/components/message/MessageEditor";

type Channel = { id: string; name: string; color: string; followers: number };
type TagOption = { name: string; channelIds: string[] };

export function Composer({ channels, tags }: { channels: Channel[]; tags: TagOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<BlockInput[]>([newBlock("text")]);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => new Set(channelIds), [channelIds]);
  const totalFollowers = channels.filter((c) => selected.has(c.id)).reduce((s, c) => s + c.followers, 0);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function submit(sendMode: "now" | "schedule" | "draft") {
    setError(null);
    if (sendMode === "now") {
      const target = channels.filter((c) => selected.has(c.id)).map((c) => c.name).join("、");
      const audience = tagNames.length ? `タグ「${tagNames.join("、")}」の人` : "友だち全員";
      if (!window.confirm(`${channelIds.length} アカウント（${target}）の${audience}に、いま配信します。よろしいですか？`)) return;
    }
    let scheduledAt: string | undefined;
    if (sendMode === "schedule") {
      if (!scheduledLocal) return setError("配信日時を指定してください");
      scheduledAt = new Date(scheduledLocal).toISOString(); // ブラウザのタイムゾーンで解釈してから送る
    }
    setBusy(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, blocks, channelIds, tagNames, mode: sendMode, scheduledAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "失敗しました");
      router.push(`/dashboard/campaigns/${data.campaignId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div className="space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}

        <Section title="1. 配信するアカウント">
          <div className="flex flex-wrap gap-2 mb-2 text-xs">
            <button type="button" className="underline" onClick={() => setChannelIds(channels.map((c) => c.id))}>
              全選択
            </button>
            <button type="button" className="underline" onClick={() => setChannelIds([])}>
              全解除
            </button>
            <span className="text-gray-500">
              {channelIds.length} / {channels.length} 選択中（友だち計 {totalFollowers.toLocaleString()} 人）
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {channels.map((c) => {
              const on = selected.has(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-2 border rounded px-3 py-2 text-sm cursor-pointer ${on ? "bg-line-light border-line" : "bg-white"}`}
                >
                  <input type="checkbox" checked={on} onChange={() => setChannelIds(toggle(channelIds, c.id))} />
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="flex-1">{c.name}</span>
                  <span className="text-xs text-gray-500">{c.followers.toLocaleString()}人</span>
                </label>
              );
            })}
          </div>
        </Section>

        <Section title="2. 配信日時">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode === "now"} onChange={() => setMode("now")} /> すぐに配信
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={mode === "schedule"} onChange={() => setMode("schedule")} /> 日時を指定
            </label>
            {mode === "schedule" && (
              <input
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
                className="border rounded px-2 py-1"
              />
            )}
          </div>
          {mode === "schedule" && (
            <p className="text-xs text-gray-500 mt-2">
              配信時刻は 1 分間隔の cron（/api/cron/dispatch）で実行されます。最大 1 分程度遅れることがあります。
            </p>
          )}
        </Section>

        <Section title="3. オーディエンス（タグ）">
          <div className="flex gap-2 mb-2 text-sm">
            <label className="flex items-center gap-1">
              <input type="radio" checked={tagNames.length === 0} onChange={() => setTagNames([])} /> 友だち全員
            </label>
            <span className="text-gray-500">／ タグで絞り込む（いずれかのタグが付いた人）</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 && <span className="text-sm text-gray-500">タグがまだありません</span>}
            {tags.map((t) => {
              const on = tagNames.includes(t.name);
              const have = t.channelIds.filter((id) => selected.has(id)).length;
              const missing = channelIds.length - have;
              return (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setTagNames(toggle(tagNames, t.name))}
                  className={`px-3 py-1 rounded border text-sm ${on ? "bg-line text-white border-line" : "bg-white"}`}
                  title={missing > 0 ? `選択中の ${missing} アカウントにはこのタグがありません` : undefined}
                >
                  {t.name}
                  <span className={`ml-1 text-xs ${on ? "text-white/80" : "text-gray-400"}`}>
                    {have}/{channelIds.length || 0}
                  </span>
                </button>
              );
            })}
          </div>
          {tagNames.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              タグは各アカウントのタグを「名前」で突き合わせます。選んだタグが 1 つも無いアカウントには配信されません（全員に送られることはありません）。
            </p>
          )}
        </Section>

        <Section title="4. メッセージ">
          <div className="mb-3">
            <label className="block text-sm font-medium">タイトル（管理用・友だちには表示されません）</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="例：10月イベントのお知らせ"
            />
          </div>

          <MessageEditor blocks={blocks} onChange={setBlocks} />
        </Section>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("draft")}
            className="border rounded px-4 py-2 text-sm bg-white disabled:opacity-50"
          >
            下書き保存
          </button>
          {mode === "schedule" ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => submit("schedule")}
              className="bg-line text-white rounded px-4 py-2 text-sm disabled:opacity-50"
            >
              予約配信する
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => submit("now")}
              className="bg-line text-white rounded px-4 py-2 text-sm disabled:opacity-50"
            >
              {busy ? "配信中…" : "いますぐ配信"}
            </button>
          )}
        </div>
      </div>

      <div className="lg:sticky lg:top-4 space-y-2">
        <div className="text-sm font-medium">プレビュー</div>
        <BlockPreview blocks={blocks} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border rounded p-4">
      <h2 className="font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}


