import type { Question } from "./types";

// ===========================================================================
// 18-question TCM 弁証 screening.
// 6 弁証 (kikyo/kitai/kekkyo/oketsu/inkyo/tanshitsu) × 3 questions each.
// Likert 0-3 (frequency): 0=まったくない 1=たまにある 2=よくある 3=ほぼいつもある
// 大分類 (axis) groupings:
//   nerve = 気虚 + 気滞 (q1-q6)
//   circ  = 血虚 + 瘀血 (q7-q12)
//   metab = 陰虚 + 痰湿 (q13-q18)
// ===========================================================================

export const QUESTIONS: Question[] = [
  // ===== 気虚 (kikyo) =====
  {
    id: "q1",
    axis: "nerve",
    bensho: "kikyo",
    text: "朝起きてもすぐに疲れを感じる",
    hint: "エネルギー(気)の不足を確認します",
  },
  {
    id: "q2",
    axis: "nerve",
    bensho: "kikyo",
    text: "少し動いただけで息切れ・倦怠感がある",
    hint: "気の推動力の弱さを確認します",
  },
  {
    id: "q3",
    axis: "nerve",
    bensho: "kikyo",
    text: "風邪をひきやすい、または治りにくい",
    hint: "衛気(免疫)の働きを確認します",
  },

  // ===== 気滞 (kitai) =====
  {
    id: "q4",
    axis: "nerve",
    bensho: "kitai",
    text: "胸やお腹、脇腹が張った感じがする",
    hint: "気のめぐりの停滞を確認します",
  },
  {
    id: "q5",
    axis: "nerve",
    bensho: "kitai",
    text: "ため息やゲップが多く出る",
    hint: "気の上下のめぐりを確認します",
  },
  {
    id: "q6",
    axis: "nerve",
    bensho: "kitai",
    text: "気分の浮き沈みやイライラを感じやすい",
    hint: "情志(感情)による気滞を確認します",
  },

  // ===== 血虚 (kekkyo) =====
  {
    id: "q7",
    axis: "circ",
    bensho: "kekkyo",
    text: "顔色が青白い・くすんで見えると言われる",
    hint: "血の量・滋養の不足を確認します",
  },
  {
    id: "q8",
    axis: "circ",
    bensho: "kekkyo",
    text: "髪のパサつき・抜け毛・爪の割れが気になる",
    hint: "血の滋潤作用を確認します",
  },
  {
    id: "q9",
    axis: "circ",
    bensho: "kekkyo",
    text: "立ちくらみ・動悸・目のかすみがある",
    hint: "心血・肝血の不足を確認します",
  },

  // ===== 瘀血 (oketsu) =====
  {
    id: "q10",
    axis: "circ",
    bensho: "oketsu",
    text: "肩こりや腰痛など、決まった部位の痛みがある",
    hint: "局所の血の停滞を確認します",
  },
  {
    id: "q11",
    axis: "circ",
    bensho: "oketsu",
    text: "手足の冷え・しびれを感じる",
    hint: "末梢循環(瘀血)を確認します",
  },
  {
    id: "q12",
    axis: "circ",
    bensho: "oketsu",
    text: "目の下のクマや唇・歯茎の色がくすんでいる",
    hint: "微小循環の停滞サインを確認します",
  },

  // ===== 陰虚 (inkyo) =====
  {
    id: "q13",
    axis: "metab",
    bensho: "inkyo",
    text: "のぼせ・ほてりを感じやすい",
    hint: "陰(冷却・潤い)の不足を確認します",
  },
  {
    id: "q14",
    axis: "metab",
    bensho: "inkyo",
    text: "寝汗をかく、または口・喉が乾きやすい",
    hint: "陰液(津液)の不足を確認します",
  },
  {
    id: "q15",
    axis: "metab",
    bensho: "inkyo",
    text: "手のひら・足の裏・胸が熱く感じる",
    hint: "五心煩熱(陰虚火旺)を確認します",
  },

  // ===== 痰湿 (tanshitsu) =====
  {
    id: "q16",
    axis: "metab",
    bensho: "tanshitsu",
    text: "体が重だるい・むくみやすい",
    hint: "水湿の停滞を確認します",
  },
  {
    id: "q17",
    axis: "metab",
    bensho: "tanshitsu",
    text: "痰がからむ、鼻水・後鼻漏が多い",
    hint: "痰湿の生成・停滞を確認します",
  },
  {
    id: "q18",
    axis: "metab",
    bensho: "tanshitsu",
    text: "お腹が張る・胃もたれ・軟便がある",
    hint: "脾の運化失調による痰湿を確認します",
  },
];

// 0-3 frequency Likert. "value" is what gets saved on the Answer.
export const LIKERT_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "まったくない" },
  { value: 1, label: "たまにある" },
  { value: 2, label: "よくある" },
  { value: 3, label: "ほぼいつもある" },
];
