/**
 * Server Components から現在のタブ key を読み出すヘルパ。
 *
 * NOTE: TabNav.tsx は "use client" のため、その中の export を Server
 * Component から普通の関数として呼ぶことはできない (Next.js が Client
 * Reference proxy に置き換えてしまうため)。本ファイルは "use client" を
 * 持たないので Server / Client どちらからも呼べる。
 */
export function activeTab(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  paramName = "tab",
  fallback = "",
): string {
  if (!searchParams) return fallback;
  const v = searchParams[paramName];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? fallback;
  return fallback;
}
