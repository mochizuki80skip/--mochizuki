// 接骨院の広告・GBP 投稿で問題になりやすい表現のチェック。
// 柔道整復師法の広告制限・医療広告ガイドライン・景品表示法・GBP のコンテンツポリシーを
// 目安にした簡易チェックであり、適法性を保証するものではない。
const RULES = [
  // error: そのまま投稿すると問題になる可能性が高い
  { level: "error", re: /治(る|ります|せます|った)|完治|根治|全快/g, msg: "「治る」等の効果の断定は避けてください（例：「〜のケアを行っています」）" },
  { level: "error", re: /必ず|絶対|100\s*[%％]|確実に/g, msg: "効果を保証する表現は避けてください" },
  { level: "error", re: /No\.?\s*1|ナンバーワン|日本一|地域一|県内一|市内一|最高|最上|唯一|一番/gi, msg: "比較優良・最上級の表現は根拠がないと使えません" },
  { level: "error", re: /体験談|お客様の声|患者様の声|口コミ(で|が)?評判/g, msg: "体験談・患者の声の掲載は避けてください" },
  { level: "error", re: /ビフォー\s*アフター|before\s*after|施術前後の写真/gi, msg: "施術前後の比較（ビフォーアフター）は避けてください" },
  { level: "error", re: /0\d{1,4}[-‐ー−\s]?\d{1,4}[-‐ー−\s]?\d{3,4}/g, msg: "本文に電話番号を書くと GBP で却下されることがあります（ボタンの「今すぐ電話」を使ってください）" },
  // warn: 文脈によっては問題
  { level: "warn", re: /即効|劇的|効果抜群|驚きの|魔法の|奇跡/g, msg: "誇大に受け取られる表現です" },
  { level: "warn", re: /(肩こり|慢性|疲労).{0,15}保険|保険.{0,15}(肩こり|慢性|疲労)/g, msg: "肩こり・慢性症状は健康保険の対象外です。保険適用と誤認させない書き方にしてください" },
  { level: "warn", re: /医師|専門医|病院/g, msg: "医師・医療機関と誤認される書き方になっていないか確認してください" },
  { level: "warn", re: /無料|0円|半額|割引|\d+\s*[%％]\s*OFF/gi, msg: "料金・割引の表示は条件と期間を明記してください" },
];

const GBP_MAX = 1500;

function checkPost(text, extraNgWords = []) {
  const found = [];
  for (const r of RULES) {
    const hits = [...new Set((text.match(r.re) || []).map((s) => s.trim()))];
    if (hits.length) found.push({ level: r.level, msg: `${r.msg}：${hits.join("、")}` });
  }
  const extra = extraNgWords.filter((w) => w && text.includes(w));
  if (extra.length) found.push({ level: "error", msg: `NG ワードが含まれています：${extra.join("、")}` });
  if (text.length > GBP_MAX) found.push({ level: "error", msg: `GBP の上限 ${GBP_MAX} 文字を超えています（${text.length} 文字）` });
  return found;
}
