import { RICH_LAYOUTS, type BlockInput } from "@/lib/campaign-blocks";

// LINE トーク画面風の簡易プレビュー（編集画面・詳細画面で共用）
export function BlockPreview({ blocks }: { blocks: BlockInput[] }) {
  return (
    <div className="bg-[#8CABD9] rounded-lg p-3 space-y-2 max-w-sm">
      {blocks.length === 0 && <div className="text-xs text-white/80">メッセージを追加するとここに表示されます</div>}
      {blocks.map((b, i) => (
        <div key={i} className="flex">
          <div className="max-w-[92%]">{renderBlock(b)}</div>
        </div>
      ))}
    </div>
  );
}

function renderBlock(b: BlockInput) {
  switch (b.type) {
    case "text":
      return (
        <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2 text-sm whitespace-pre-wrap break-words">
          {b.text || <span className="text-gray-400">（本文）</span>}
        </div>
      );
    case "image":
      return b.mediaId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/media/${b.mediaId}`} alt="" className="rounded-lg max-h-64" />
      ) : (
        <Placeholder text="画像未選択" />
      );
    case "rich": {
      if (!b.mediaId) return <Placeholder text="リッチメッセージ画像未選択" />;
      const rects = RICH_LAYOUTS[b.layout].areas;
      return (
        <div className="relative rounded-lg overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/media/${b.mediaId}`} alt="" className="block w-full" />
          {rects.map(([x, y, w, h], i) => (
            <div
              key={i}
              className="absolute border border-white/70 flex items-center justify-center"
              style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
            >
              <span className="bg-black/50 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      );
    }
    case "cards":
      return (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ maxWidth: 340 }}>
          {b.cards.map((c, i) => (
            <div key={i} className="bg-white rounded-lg overflow-hidden shrink-0 w-48">
              {c.mediaId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/media/${c.mediaId}`} alt="" className="w-full aspect-[20/13] object-cover" />
              )}
              <div className="p-2">
                <div className="font-bold text-sm break-words">{c.title || "（タイトル）"}</div>
                {c.description && <div className="text-xs text-gray-500 mt-1 break-words">{c.description}</div>}
              </div>
              <div className="p-2 pt-0 space-y-1">
                {c.buttons.map((btn, j) => (
                  <div
                    key={j}
                    className={`text-center text-xs rounded py-1.5 ${
                      j === 0 ? "bg-line text-white" : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {btn.label || "ボタン"}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
  }
}

function Placeholder({ text }: { text: string }) {
  return <div className="bg-white/70 rounded-lg px-4 py-6 text-xs text-gray-500 text-center">{text}</div>;
}
