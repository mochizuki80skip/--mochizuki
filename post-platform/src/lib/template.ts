// テンプレートの差し込み。{院名} {地名} {エリア} などを店舗リストの値に置き換える。
// 全角の ｛｝ でも書けるようにしている。
export type TemplateStore = {
  name: string;
  city: string;
  area: string;
  features: string;
  bookingUrl: string;
  vars: Record<string, string>;
};

// 標準の差し込み項目（店舗リストの列名と対応）
export const STANDARD_FIELDS: { key: string; label: string; get: (s: TemplateStore) => string }[] = [
  { key: "院名", label: "院名", get: (s) => s.name },
  { key: "地名", label: "地名（市区町村など）", get: (s) => s.city },
  { key: "エリア", label: "エリア（駅名・地域）", get: (s) => s.area },
  { key: "特徴", label: "得意な施術・特徴", get: (s) => s.features },
  { key: "予約URL", label: "予約ページ URL", get: (s) => s.bookingUrl },
];
const ALIASES: Record<string, string> = { 店舗名: "院名", 店名: "院名" };

const PLACEHOLDER = /[{｛]\s*([^{}｛｝\s]{1,20})\s*[}｝]/g;

export function placeholders(tpl: string) {
  return [...new Set([...tpl.matchAll(PLACEHOLDER)].map((m) => ALIASES[m[1]] ?? m[1]))];
}

export function fillTemplate(tpl: string, store: TemplateStore) {
  const missing = new Set<string>();
  const text = tpl.replace(PLACEHOLDER, (_, raw: string) => {
    const key = ALIASES[raw] ?? raw;
    const std = STANDARD_FIELDS.find((f) => f.key === key);
    const value = (std ? std.get(store) : store.vars[key]) ?? "";
    if (!value.trim()) {
      missing.add(key);
      return `{${key}}`;
    }
    return value;
  });
  return { text, missing: [...missing] };
}
