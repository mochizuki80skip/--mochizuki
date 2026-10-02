"use client";

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
import { ImageUploader } from "./ImageUploader";

export const BLOCK_LABEL: Record<BlockInput["type"], string> = {
  text: "テキスト",
  image: "画像",
  rich: "リッチメッセージ",
  cards: "カードタイプ",
};

export function newBlock(type: BlockInput["type"]): BlockInput {
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

/** 吹き出し（ブロック）の追加・並び替え・削除・編集をまとめたエディタ */
export function MessageEditor({
  blocks,
  onChange,
}: {
  blocks: BlockInput[];
  onChange: (blocks: BlockInput[]) => void;
}) {
  const patchBlock = (i: number, b: BlockInput) => onChange(blocks.map((x, j) => (j === i ? b : x)));
  const moveBlock = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div>
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
                <IconBtn onClick={() => onChange(blocks.filter((_, j) => j !== i))} label="削除"><Trash2 size={14} /></IconBtn>
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
              onClick={() => onChange([...blocks, newBlock(t)])}
              className="border rounded px-3 py-1.5 text-sm flex items-center gap-1 bg-white"
            >
              <Plus size={14} /> {BLOCK_LABEL[t]}
            </button>
          ))}
          <span className="text-xs text-gray-500 self-center">最大 {MAX_BLOCKS} つまで</span>
        </div>
      )}
    </div>
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
