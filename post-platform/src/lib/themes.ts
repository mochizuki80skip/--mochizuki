// 投稿テーマのローテーションと季節の話題
export const THEMES = [
  "季節の身体のケア",
  "症状の解説（ぎっくり腰・寝違え・肩こりなど）",
  "自宅でできるセルフケア・ストレッチ",
  "スポーツのケガ・部活動",
  "姿勢・骨盤のケア",
  "交通事故のケガ",
  "院内・スタッフの紹介",
  "デスクワーク・スマホ姿勢の負担",
];

const SEASON_TOPICS: Record<number, string> = {
  1: "寒さによる肩・首のこわばりやぎっくり腰",
  2: "寒さと冷えによる腰まわりの負担",
  3: "新生活に向けた姿勢と身体の準備",
  4: "新生活の疲れやデスクワークによる首・肩の負担",
  5: "気温差による身体のだるさと運動再開時のケガ",
  6: "梅雨時期の身体の重さや関節の違和感",
  7: "冷房による冷えと夏の運動時のケガ",
  8: "夏の疲れと冷房による身体のこわばり",
  9: "季節の変わり目の身体の不調と秋のスポーツ",
  10: "朝晩の冷え込みによる寝違えや腰の負担",
  11: "寒さによる筋肉のこわばりと転倒によるケガ",
  12: "年末の忙しさによる疲れと大掃除での腰の負担",
};

export const seasonTopic = (d: Date) => SEASON_TOPICS[jstParts(d).month];

// JST の年月日・曜日
export function jstParts(d: Date) {
  const j = new Date(d.getTime() + 9 * 3600_000);
  return { year: j.getUTCFullYear(), month: j.getUTCMonth() + 1, day: j.getUTCDate(), weekday: j.getUTCDay() };
}

// JST の日付＋時刻から Date を作る
export function jstDate(year: number, month: number, day: number, time: string) {
  const [h, m] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, h - 9, m || 0));
}

export const fmtJst = (d: Date) =>
  d.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
