// 接骨院の広告・GBP / Instagram 投稿で問題になりやすい表現のチェック。
// 柔道整復師法の広告制限・医療広告ガイドライン・景品表示法・GBP のポリシーを目安にした
// 簡易チェックであり、適法性を保証するものではない。
export type Flag = { level: "error" | "warn"; channel: "gbp" | "instagram"; msg: string };

type Rule = { level: "error" | "warn"; re: RegExp; msg: string; gbpOnly?: boolean };

const RULES: Rule[] = [
  { level: "error", re: /治(る|ります|せます|った)|完治|根治|全快/g, msg: "「治る」等の効果の断定" },
  { level: "error", re: /必ず|絶対|100\s*[%％]|確実に/g, msg: "効果を保証する表現" },
  { level: "error", re: /No\.?\s*1|ナンバーワン|日本一|地域一|県内一|市内一|最高|最上|唯一/gi, msg: "比較・最上級の表現" },
  { level: "error", re: /体験談|お客様の声|患者様の声/g, msg: "体験談・患者の声" },
  { level: "error", re: /ビフォー\s*アフター|before\s*after|施術前後の写真/gi, msg: "施術前後の比較" },
  { level: "error", re: /0\d{1,4}[-‐ー−\s]?\d{1,4}[-‐ー−\s]?\d{3,4}/g, msg: "本文中の電話番号（GBP で却下されやすい）", gbpOnly: true },
  { level: "warn", re: /即効|劇的|効果抜群|驚きの|魔法の|奇跡/g, msg: "誇大に受け取られる表現" },
  { level: "warn", re: /(肩こり|慢性|疲労).{0,15}保険|保険.{0,15}(肩こり|慢性|疲労)/g, msg: "肩こり・慢性症状は保険対象外（誤認注意）" },
  { level: "warn", re: /医師|専門医|病院/g, msg: "医師・医療機関と誤認される書き方" },
  { level: "warn", re: /無料|0円|半額|割引|\d+\s*[%％]\s*OFF/gi, msg: "料金・割引は条件と期間を明記" },
];

export const GBP_MAX = 1500;
export const IG_MAX = 2200;

export function checkText(text: string, channel: "gbp" | "instagram", extraNgWords: string[] = []): Flag[] {
  const flags: Flag[] = [];
  for (const r of RULES) {
    if (r.gbpOnly && channel !== "gbp") continue;
    const hits = [...new Set(text.match(r.re) ?? [])];
    if (hits.length) flags.push({ level: r.level, channel, msg: `${r.msg}：${hits.join("、")}` });
  }
  const extra = extraNgWords.filter((w) => w && text.includes(w));
  if (extra.length) flags.push({ level: "error", channel, msg: `NG ワード：${extra.join("、")}` });
  const max = channel === "gbp" ? GBP_MAX : IG_MAX;
  if (text.length > max) flags.push({ level: "error", channel, msg: `${max} 文字を超えています（${text.length} 文字）` });
  if (channel === "instagram" && (text.match(/#/g) ?? []).length > 30) {
    flags.push({ level: "error", channel, msg: "ハッシュタグは 30 個までです" });
  }
  return flags;
}

export function checkPost(
  p: { gbpText: string; igCaption: string },
  opts: { gbp: boolean; instagram: boolean; extraNgWords: string[] },
): Flag[] {
  return [
    ...(opts.gbp ? checkText(p.gbpText, "gbp", opts.extraNgWords) : []),
    ...(opts.instagram ? checkText(p.igCaption, "instagram", opts.extraNgWords) : []),
  ];
}

export const hasError = (flags: Flag[]) => flags.some((f) => f.level === "error");

export const splitLines = (s: string) =>
  s.split("\n").map((x) => x.trim()).filter(Boolean);
