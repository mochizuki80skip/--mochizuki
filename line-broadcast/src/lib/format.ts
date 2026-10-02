// サーバ（Vercel は UTC）で描画しても日本時間で表示されるよう、タイムゾーンを固定する
const TZ = "Asia/Tokyo";

export function fmtJst(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("ja-JP", { timeZone: TZ });
}

export function fmtJstDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ja-JP", { timeZone: TZ });
}
