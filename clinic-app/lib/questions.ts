import type { Question } from "./types";

// 15-question constitution diagnosis.
// 5 questions per axis (nerve / circ / metab).
// All items are framed as "how often / how strongly do you experience this?"
// Likert 1-5: 1=ほぼない, 2=あまりない, 3=ときどき, 4=よくある, 5=いつも
//
// Items selected from autonomic dysregulation / circulatory stagnation /
// metabolic-digestive dysfunction patterns commonly screened in clinical
// intake at 鍼灸院, blended with behavioral psychology cues
// (sleep hygiene, stress reactivity, eating behavior).

export const QUESTIONS: Question[] = [
  // ===== 神経軸 =====
  {
    id: "n1",
    axis: "nerve",
    text: "寝つきが悪い、または夜中に目が覚めることがある",
    hint: "副交感神経の働きや睡眠の質を確認します",
  },
  {
    id: "n2",
    axis: "nerve",
    text: "些細なことでイライラしたり、不安を感じやすい",
    hint: "ストレス反応の過敏さを確認します",
  },
  {
    id: "n3",
    axis: "nerve",
    text: "音や光、人混みに敏感で疲れやすい",
    hint: "感覚情報の処理状態を確認します",
  },
  {
    id: "n4",
    axis: "nerve",
    text: "肩や首、顎まわりがいつも緊張している感じがある",
    hint: "慢性的な筋緊張は交感神経優位のサインです",
  },
  {
    id: "n5",
    axis: "nerve",
    text: "考えがまとまらず、集中力が続かない",
    hint: "脳神経の疲労・自律神経の乱れを確認します",
  },
  // ===== 循環軸 =====
  {
    id: "c1",
    axis: "circ",
    text: "手足が冷えやすい(特に末端)",
    hint: "末梢循環の状態を確認します",
  },
  {
    id: "c2",
    axis: "circ",
    text: "立ちくらみや、めまいを感じることがある",
    hint: "起立性の循環調節を確認します",
  },
  {
    id: "c3",
    axis: "circ",
    text: "顔色がくすむ、唇や爪の色が薄い",
    hint: "酸素運搬・微小循環のサインです",
  },
  {
    id: "c4",
    axis: "circ",
    text: "夕方になると足や顔がむくみやすい",
    hint: "リンパ・体液循環の停滞を確認します",
  },
  {
    id: "c5",
    axis: "circ",
    text: "肩こりや腰のだるさが慢性的にある",
    hint: "局所循環の停滞を確認します",
  },
  // ===== 代謝軸 =====
  {
    id: "m1",
    axis: "metab",
    text: "朝起きても疲れが残っている、回復した感じがしない",
    hint: "夜間のエネルギー回復・代謝を確認します",
  },
  {
    id: "m2",
    axis: "metab",
    text: "食後に強い眠気や倦怠感を感じる",
    hint: "血糖・代謝のスイッチング機能を確認します",
  },
  {
    id: "m3",
    axis: "metab",
    text: "便秘・下痢など、お通じの不調がある",
    hint: "消化吸収・排出機能を確認します",
  },
  {
    id: "m4",
    axis: "metab",
    text: "肌荒れ・口内炎・吹き出物ができやすい",
    hint: "老廃物の排出・炎症コントロールを確認します",
  },
  {
    id: "m5",
    axis: "metab",
    text: "体重や体型が変動しやすい(増えやすい/減りやすい)",
    hint: "ホルモン・代謝バランスを確認します",
  },
];

export const LIKERT_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "ほぼない" },
  { value: 2, label: "あまりない" },
  { value: 3, label: "ときどき" },
  { value: 4, label: "よくある" },
  { value: 5, label: "いつも" },
];
