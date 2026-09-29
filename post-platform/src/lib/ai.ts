import { seasonTopic, jstParts } from "@/lib/themes";

// Gemini で店舗ごとの GBP 投稿文と Instagram キャプションを作成
export type StoreInfo = { name: string; area: string; features: string; hashtags: string };

export async function generatePost(args: {
  store: StoreInfo;
  theme: string;
  memo: string;
  scheduledAt: Date;
  commonHashtags: string;
  withInstagram: boolean;
}): Promise<{ gbp: string; instagram: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY が設定されていません");
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const { month } = jstParts(args.scheduledAt);
  const s = args.store;

  const prompt = `あなたは接骨院チェーンの Google ビジネスプロフィール（GBP）と Instagram の投稿文を書く担当者です。
次の店舗向けの投稿を作成し、JSON で返してください。

# 店舗
- 院名：${s.name}
- 地域：${s.area || "（未設定）"}
- 特徴：${s.features || "（未設定）"}

# 投稿の条件
- テーマ：${args.theme}
- 時期：${month}月（この時期に多い悩み：${seasonTopic(args.scheduledAt)}）
- 本部からの補足：${args.memo || "なし"}
- 同じテーマで全店舗に投稿するため、この店舗の地域や特徴を活かし、定型文にならない言い回しにする

# 出力（JSON）
- "gbp"：GBP 用。250〜400 文字。冒頭に【】付きの短い見出し。地域名と院名を自然に 1 回ずつ入れる。電話番号・URL・ハッシュタグは書かない。絵文字は使わない
- "instagram"：${args.withInstagram ? `Instagram 用キャプション。gbp と同じ内容を親しみやすく 200〜350 文字にし、改行を入れて読みやすく。絵文字は 2〜4 個まで。最後に空行を入れてハッシュタグを 8〜12 個（次のタグを必ず含める：${[args.commonHashtags, s.hashtags].filter(Boolean).join(" ") || "なし"}。残りは地域名やテーマに合うもの）` : `空文字`}

# 必ず守ること（柔道整復師法・医療広告ガイドライン・景品表示法）
- 「治る」「完治」「必ず」「絶対」「100%」など効果を断定・保証する表現を使わない
- 「No.1」「地域一」「最高」など比較・最上級の表現を使わない
- 患者の体験談や施術前後の比較を書かない
- 肩こりや慢性的な症状に健康保険が使えるような書き方をしない
- 不安をあおる書き方をしない`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { gbp: { type: "STRING" }, instagram: { type: "STRING" } },
          required: ["gbp", "instagram"],
        },
        temperature: 0.9,
      },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${json.error?.message ?? "unknown"}`);
  const text = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const out = JSON.parse(text) as { gbp?: string; instagram?: string };
  if (!out.gbp) throw new Error("AI から本文が返りませんでした");
  return { gbp: out.gbp.trim(), instagram: args.withInstagram ? (out.instagram ?? "").trim() : "" };
}
