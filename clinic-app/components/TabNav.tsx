"use client";

import { usePathname, useRouter } from "next/navigation";

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
  /** 現在アクティブなタブ key (Server Component から渡す) */
  current: string;
  /** クエリ param の名前 (デフォルト "tab") */
  paramName?: string;
};

/**
 * URL クエリ駆動のタブナビ。
 * 親 Server Component が `current` を渡し、クリックで URL クエリを更新する。
 * useSearchParams() は使わない (Suspense 不要、SSR で確定的)。
 */
export default function TabNav({ items, current, paramName = "tab" }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function go(key: string) {
    const params = new URLSearchParams();
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

// activeTab() は Server Component からも呼ぶため、"use client" な本ファイル
// からは export しない。代わりに lib/active-tab.ts に分離してある。
