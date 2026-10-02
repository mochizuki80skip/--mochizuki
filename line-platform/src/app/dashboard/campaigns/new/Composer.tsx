"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import {
  MAX_BLOCKS,
  MAX_BUTTONS,
  MAX_CARDS,
  RICH_LAYOUTS,
  RICH_LAYOUT_KEYS,
  type BlockInput,
  type CardT,
  type RichLayout,
} from "@/lib/campaign-blocks";
import { BlockPreview } from "../BlockPreview";
import { ImageUploader } from "../ImageUploader";

type Channel = { id: string; name: string; color: string; followers: number };
type TagOption = { name: string; channelIds: string[] };

const BLOCK_LABEL: Record<BlockInput["type"], string> = {
  text: "テキスト",
  image: "画像",
  rich: "リッチメッセージ",
  cards: "カードタイプ",
};

function newBlock(type: BlockInput["type"]): BlockInput {
  switch (type) {
    case "text":
      return { type, text: "" };
    case "image":
      return { type, mediaId: "" };
    case "rich":
      return { type, mediaId: "", ratio: 1, layout: "1", areas: [{ kind: "uri", value: "" }], altText: "" };
    case "cards":
      return { type, altText: "", cards: [newCard()] };
  }
}
function newCard(): CardT {
  return { title: "", description: "", buttons: [{ label: "", uri: "" }] };
}

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
  const patchBlock = (i: number, b: BlockInput) => setBlocks((bs) => bs.map((x, j) => (j === i ? b : x)));
  const moveBlock = (i: number, d: -1 | 1) =>
    setBlocks((bs) => {
      const j = i + d;
      if (j < 0 || j >= bs.length) return bs;
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

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

          <div className="space-y-3">
            {blocks.map((b, i) => (
              <div key={i} className="border rounded bg-gray-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {i + 1}. {BLOCK_LABEL[b.type]}
                  </div>
                  <div className="flex items-center gap-1 text-gray-500">
                    <IconBtn onClick={() => moveBlock(i, -1)} disabled={i === 0} label="上へ"><ArrowUp size={14} /></IconBtn>
                    <IconBtn onClick={() => moveBlock(i, 1)} disabled={i === blocks.length - 1} label="下へ"><ArrowDown size={14} /></IconBtn>
                    <IconBtn onClick={() => setBlocks(blocks.filter((_, j) => j !== i))} label="削除"><Trash2 size={14} /></IconBtn>
                  </div>
                </div>
                <BlockEditor block={b} onChange={(nb) => patchBlock(i, nb)} />
              </div>
            ))}
          </div>

          {blocks.length < MAX_BLOCKS && (
            <div className="flex flex-wrap gap-2 mt-3">
              {(Object.keys(BLOCK_LABEL) as BlockInput["type"][]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBlocks([...blocks, newBlock(t)])}
                  className="border rounded px-3 py-1.5 text-sm flex items-center gap-1 bg-white"
                >
                  <Plus size={14} /> {BLOCK_LABEL[t]}
                </button>
              ))}
              <span className="text-xs text-gray-500 self-center">最大 {MAX_BLOCKS} つまで</span>
            </div>
          )}
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

function IconBtn({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const input = "w-full border rounded px-3 py-1.5 text-sm bg-white";

function BlockEditor({ block, onChange }: { block: BlockInput; onChange: (b: BlockInput) => void }) {
  switch (block.type) {
    case "text":
      return (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          rows={5}
          maxLength={5000}
          className={input}
          placeholder="本文を入力"
        />
      );

    case "image":
      return (
        <ImageUploader
          mediaId={block.mediaId}
          maxWidth={1024}
          onUploaded={(img) => onChange({ ...block, mediaId: img.id })}
          onClear={() => onChange({ ...block, mediaId: "" })}
        />
      );

    case "rich": {
      const count = RICH_LAYOUTS[block.layout].areas.length;
      const setLayout = (layout: RichLayout) => {
        const n = RICH_LAYOUTS[layout].areas.length;
        const areas = Array.from({ length: n }, (_, i) => block.areas[i] ?? { kind: "uri" as const, value: "" });
        onChange({ ...block, layout, areas });
      };
      return (
        <div className="space-y-3">
          <ImageUploader
            mediaId={block.mediaId}
            maxWidth={1040}
            label="リッチメッセージ画像を選択（横幅 1040px に縮小されます）"
            onUploaded={(img) => onChange({ ...block, mediaId: img.id, ratio: img.height / img.width })}
            onClear={() => onChange({ ...block, mediaId: "" })}
          />
          <div className="flex flex-wrap gap-2">
            {RICH_LAYOUT_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setLayout(k)}
                className={`px-2 py-1 rounded border text-xs ${block.layout === k ? "bg-line text-white border-line" : "bg-white"}`}
              >
                {RICH_LAYOUTS[k].label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: count }, (_, i) => {
              const a = block.areas[i] ?? { kind: "uri" as const, value: "" };
              const setArea = (patch: Partial<typeof a>) =>
                onChange({ ...block, areas: block.areas.map((x, j) => (j === i ? { ...a, ...patch } : x)) });
              return (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-xs w-12 text-gray-500">エリア{i + 1}</span>
                  <select value={a.kind} onChange={(e) => setArea({ kind: e.target.value as "uri" | "text" })} className="border rounded px-2 py-1.5 text-sm bg-white">
                    <option value="uri">リンク</option>
                    <option value="text">テキスト送信</option>
                  </select>
                  <input
                    value={a.value}
                    onChange={(e) => setArea({ value: e.target.value })}
                    className={input}
                    placeholder={a.kind === "uri" ? "https://..." : "タップ時に送信されるテキスト"}
                  />
                </div>
              );
            })}
          </div>
          <input
            value={block.altText}
            onChange={(e) => onChange({ ...block, altText: e.target.value })}
            className={input}
            maxLength={400}
            placeholder="代替テキスト（通知・トーク一覧に表示されます）"
          />
        </div>
      );
    }

    case "cards": {
      const setCard = (i: number, c: CardT) => onChange({ ...block, cards: block.cards.map((x, j) => (j === i ? c : x)) });
      return (
        <div className="space-y-3">
          <input
            value={block.altText}
            onChange={(e) => onChange({ ...block, altText: e.target.value })}
            className={input}
            maxLength={400}
            placeholder="代替テキスト（通知・トーク一覧に表示されます）"
          />
          {block.cards.map((c, i) => (
            <div key={i} className="border rounded bg-white p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">カード {i + 1}</span>
                {block.cards.length > 1 && (
                  <IconBtn label="カードを削除" onClick={() => onChange({ ...block, cards: block.cards.filter((_, j) => j !== i) })}>
                    <Trash2 size={14} />
                  </IconBtn>
                )}
              </div>
              <ImageUploader
                mediaId={c.mediaId}
                maxWidth={1024}
                label="画像を選択（任意）"
                onUploaded={(img) => setCard(i, { ...c, mediaId: img.id })}
                onClear={() => setCard(i, { ...c, mediaId: undefined })}
              />
              <input value={c.title} maxLength={40} onChange={(e) => setCard(i, { ...c, title: e.target.value })} className={input} placeholder="タイトル（40文字まで）" />
              <input value={c.description ?? ""} maxLength={60} onChange={(e) => setCard(i, { ...c, description: e.target.value })} className={input} placeholder="説明文（60文字まで・任意）" />
              {c.buttons.map((btn, j) => (
                <div key={j} className="flex gap-2">
                  <input
                    value={btn.label}
                    maxLength={20}
                    onChange={(e) => setCard(i, { ...c, buttons: c.buttons.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })}
                    className="w-32 border rounded px-3 py-1.5 text-sm"
                    placeholder="ボタン名"
                  />
                  <input
                    value={btn.uri}
                    onChange={(e) => setCard(i, { ...c, buttons: c.buttons.map((x, k) => (k === j ? { ...x, uri: e.target.value } : x)) })}
                    className={input}
                    placeholder="https://..."
                  />
                  <IconBtn label="ボタンを削除" onClick={() => setCard(i, { ...c, buttons: c.buttons.filter((_, k) => k !== j) })}>
                    <Trash2 size={14} />
                  </IconBtn>
                </div>
              ))}
              {c.buttons.length < MAX_BUTTONS && (
                <button type="button" className="text-xs underline" onClick={() => setCard(i, { ...c, buttons: [...c.buttons, { label: "", uri: "" }] })}>
                  + ボタンを追加
                </button>
              )}
            </div>
          ))}
          {block.cards.length < MAX_CARDS && (
            <button type="button" className="border rounded px-3 py-1.5 text-sm bg-white" onClick={() => onChange({ ...block, cards: [...block.cards, newCard()] })}>
              + カードを追加（最大 {MAX_CARDS} 枚）
            </button>
          )}
        </div>
      );
    }
  }
}
