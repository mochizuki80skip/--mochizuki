// 一括配信の編集ブロック定義と、LINE Messaging API 形式への変換。
// クライアント（プレビュー）とサーバ（検証・変換）の両方から使うので、server-only な import はしない。
import { z } from "zod";

export const MAX_BLOCKS = 5; // LINE は 1 配信あたり最大 5 吹き出し
export const MAX_CARDS = 10;
export const MAX_BUTTONS = 3;

// リッチメッセージのタップ領域レイアウト（x, y, w, h は 0〜1 の割合）
export const RICH_LAYOUTS = {
  "1": { label: "全面 1 つ", areas: [[0, 0, 1, 1]] },
  "2h": { label: "左右 2 分割", areas: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]] },
  "2v": { label: "上下 2 分割", areas: [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]] },
  "3c": { label: "3 列", areas: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
  "4": { label: "4 分割", areas: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]] },
  "6": {
    label: "6 分割",
    areas: [
      [0, 0, 1 / 3, 0.5], [1 / 3, 0, 1 / 3, 0.5], [2 / 3, 0, 1 / 3, 0.5],
      [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5],
    ],
  },
} as const;
export type RichLayout = keyof typeof RICH_LAYOUTS;
export const RICH_LAYOUT_KEYS = Object.keys(RICH_LAYOUTS) as RichLayout[];

const uri = z
  .string()
  .trim()
  .max(1000)
  .regex(/^(https?:\/\/|tel:|line:\/\/)\S+$/, "リンクは https:// などで始まる URL を入力してください");

const mediaId = z.string().min(1, "画像をアップロードしてください").max(64);

const TextBlock = z.object({
  type: z.literal("text"),
  text: z.string().min(1, "本文を入力してください").max(5000),
});

const ImageBlock = z.object({
  type: z.literal("image"),
  mediaId,
});

const RichArea = z.object({
  kind: z.enum(["uri", "text"]),
  value: z.string().trim().min(1, "リッチメッセージの各エリアにリンクまたはテキストを設定してください").max(1000),
});

const RichBlock = z.object({
  type: z.literal("rich"),
  mediaId,
  // 画像の縦横比 (height / width)。imagemap の高さ算出に使う
  ratio: z.number().min(0.2).max(2),
  layout: z.enum(RICH_LAYOUT_KEYS as [RichLayout, ...RichLayout[]]),
  areas: z.array(RichArea).min(1).max(6),
  altText: z.string().trim().min(1, "リッチメッセージの代替テキストを入力してください").max(400),
});

const Card = z.object({
  mediaId: mediaId.optional(),
  title: z.string().trim().min(1, "カードのタイトルを入力してください").max(40),
  description: z.string().trim().max(60).optional(),
  buttons: z
    .array(
      z.object({
        label: z.string().trim().min(1, "ボタン名を入力してください").max(20),
        uri,
      }),
    )
    .max(MAX_BUTTONS),
});

const CardsBlock = z.object({
  type: z.literal("cards"),
  altText: z.string().trim().min(1, "カードの代替テキストを入力してください").max(400),
  cards: z.array(Card).min(1).max(MAX_CARDS),
});

export const Block = z.discriminatedUnion("type", [TextBlock, ImageBlock, RichBlock, CardsBlock]);
export const Blocks = z.array(Block).min(1, "メッセージを 1 つ以上追加してください").max(MAX_BLOCKS);

export type BlockInput = z.infer<typeof Block>;
export type TextBlockT = z.infer<typeof TextBlock>;
export type ImageBlockT = z.infer<typeof ImageBlock>;
export type RichBlockT = z.infer<typeof RichBlock>;
export type CardsBlockT = z.infer<typeof CardsBlock>;
export type CardT = z.infer<typeof Card>;

export function mediaUrl(baseUrl: string, id: string) {
  return `${baseUrl.replace(/\/$/, "")}/api/media/${id}`;
}

// 返り値は @line/bot-sdk の Message 互換の素の JSON
export function buildMessages(blocks: BlockInput[], baseUrl: string): Record<string, unknown>[] {
  return blocks.map((b) => {
    switch (b.type) {
      case "text":
        return { type: "text", text: b.text };

      case "image": {
        const url = mediaUrl(baseUrl, b.mediaId);
        return { type: "image", originalContentUrl: url, previewImageUrl: url };
      }

      case "rich": {
        const width = 1040;
        const height = Math.min(2080, Math.max(1, Math.round(width * b.ratio)));
        const rects = RICH_LAYOUTS[b.layout].areas;
        if (b.areas.length !== rects.length) {
          throw new Error("リッチメッセージのエリア数がレイアウトと一致しません");
        }
        return {
          type: "imagemap",
          // LINE は baseUrl の末尾に /1040 などを付けて取得する
          baseUrl: mediaUrl(baseUrl, b.mediaId),
          altText: b.altText,
          baseSize: { width, height },
          actions: rects.map(([x, y, w, h], i) => {
            const area = {
              x: Math.round(x * width),
              y: Math.round(y * height),
              width: Math.round(w * width),
              height: Math.round(h * height),
            };
            const a = b.areas[i];
            return a.kind === "uri"
              ? { type: "uri", linkUri: a.value, area }
              : { type: "message", text: a.value, area };
          }),
        };
      }

      case "cards":
        return {
          type: "flex",
          altText: b.altText,
          contents: {
            type: "carousel",
            contents: b.cards.map((c) => buildBubble(c, baseUrl)),
          },
        };
    }
  });
}

function buildBubble(c: CardT, baseUrl: string) {
  const body: Record<string, unknown>[] = [
    { type: "text", text: c.title, weight: "bold", size: "lg", wrap: true },
  ];
  if (c.description) {
    body.push({ type: "text", text: c.description, size: "sm", color: "#666666", wrap: true, margin: "md" });
  }
  const bubble: Record<string, unknown> = {
    type: "bubble",
    body: { type: "box", layout: "vertical", contents: body },
  };
  if (c.mediaId) {
    bubble.hero = {
      type: "image",
      url: mediaUrl(baseUrl, c.mediaId),
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    };
  }
  if (c.buttons.length > 0) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: c.buttons.map((btn, i) => ({
        type: "button",
        style: i === 0 ? "primary" : "secondary",
        height: "sm",
        action: { type: "uri", label: btn.label, uri: btn.uri },
      })),
    };
  }
  return bubble;
}
