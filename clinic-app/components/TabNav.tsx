"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type TabItem = {
  /** クエリ param の値 (例: "summary") */
  key: string;
  /** 表示テキスト */
  label: string;
  /** 任意: バッジ用テキスト (件数など) */
  badge?: string | number;
};

type Props = {
  items: TabItem[];
  /** クエリ param の名前 (デフォルト "tab") */
  paramName?: string;
  /** デフォルトのタブ key (param が無い時に選択される) */
  defaultKey?: string;
};

/**
 * URL クエリ駆動のタブナビ。
 *  - ?tab=<key> でアクティブなタブが決まる
 *  - クリックでクエリだけ更新 (Next.js の shallow ナビ)
 *  - 直リンク・リロード・ブラウザ戻るに対応
 */
export default function TabNav({
  items,
  paramName = "tab",
  defaultKey,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? defaultKey ?? items[0]?.key;

  function go(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="sticky top-0 z-20 -mx-5 px-5 pt-2 pb-2 bg-white/95 backdrop-blur border-b border-ink-100 mb-4">
      <div
        role="tablist"
        className="flex gap-1 p-1 bg-ink-50 rounded-full overflow-x-auto"
      >
        {items.map((it) => {
          const active = it.key === current;
          return (
            <button
              key={it.key}
              role="tab"
              aria-selected={active}
              onClick={() => go(it.key)}
              className={[
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition tabular-nums",
                active
                  ? "bg-white text-ink-900 shadow-soft"
                  : "text-ink-500 hover:text-ink-900",
              ].join(" ")}
            >
              {it.label}
              {it.badge !== undefined && (
                <span
                  className={[
                    "ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px]",
                    active
                      ? "bg-accent text-ink-900"
                      : "bg-ink-200 text-ink-600",
                  ].join(" ")}
                >
                  {it.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Server Components から現在のタブを読むためのヘルパ。
 * page の searchParams を渡して使う。
 */
export function activeTab(
  searchParams: Record<string, string | string[] | undefined>,
  paramName = "tab",
  fallback?: string,
): string | undefined {
  const v = searchParams[paramName];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0];
  return fallback;
}
