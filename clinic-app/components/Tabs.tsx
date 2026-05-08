"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ===========================================================================
// 高速タブ切替コンポーネント。
//
// 設計のポイント:
//  - 親 Server Component は 4 つのパネル全てを *一度* HTML にレンダリング
//  - 切替は純粋なクライアント state 変更で、サーバー再レンダリングなし
//  - 結果: ネットワーク往復ゼロ → 切替が瞬時
//  - URL は history.replaceState で同期 (戻るボタン・直リンク対応はキープ)
// ===========================================================================

type TabsContextValue = {
  active: string;
  setActive: (key: string) => void;
};

const TabsContext = createContext<TabsContextValue>({
  active: "",
  setActive: () => {},
});

export type TabItem = {
  key: string;
  label: string;
  badge?: string | number;
};

export function TabsRoot({
  defaultActive,
  paramName = "tab",
  children,
}: {
  defaultActive: string;
  paramName?: string;
  children: ReactNode;
}) {
  const [active, setActive] = useState(defaultActive);
  const initializedRef = useRef(false);

  // マウント時に URL から初期タブを読む (直リンク対応)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    try {
      const url = new URL(window.location.href);
      const fromUrl = url.searchParams.get(paramName);
      if (fromUrl && fromUrl !== active) setActive(fromUrl);
    } catch {
      /* noop */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramName]);

  // タブ変更時に URL を同期 (Next.js のナビゲーションは発火させない)
  useEffect(() => {
    if (!initializedRef.current) return;
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get(paramName) === active) return;
      url.searchParams.set(paramName, active);
      window.history.replaceState({}, "", url.toString());
    } catch {
      /* noop */
    }
  }, [active, paramName]);

  return (
    <TabsContext.Provider value={{ active, setActive }}>
      {children}
    </TabsContext.Provider>
  );
}

export function TabsNav({ items }: { items: TabItem[] }) {
  const { active, setActive } = useContext(TabsContext);
  return (
    <div className="sticky top-0 z-20 -mx-5 px-5 pt-2 pb-2 bg-white/95 backdrop-blur border-b border-ink-100 mb-4">
      <div
        role="tablist"
        className="flex gap-1 p-1 bg-ink-50 rounded-full overflow-x-auto"
      >
        {items.map((it) => {
          const isActive = it.key === active;
          return (
            <button
              key={it.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(it.key)}
              className={[
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition tabular-nums",
                isActive
                  ? "bg-white text-ink-900 shadow-soft"
                  : "text-ink-500 hover:text-ink-900",
              ].join(" ")}
            >
              {it.label}
              {it.badge !== undefined && (
                <span
                  className={[
                    "ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px]",
                    isActive
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
 * 一つのタブのコンテンツ。
 * 非アクティブ時は `hidden` 属性で見えなくしつつ DOM には残す
 *  → 初期マウント時の重い処理 (例: PatientCalendarSection の useState 初期化)
 *    が一度だけ走り、再表示時はそのまま見えるだけになる。
 *
 * もしメモリ・初期描画コストが気になるタブがあれば、そのパネルだけ
 * `unmountWhenInactive` を渡すと未表示時は children を返さない。
 */
export function TabsPanel({
  name,
  unmountWhenInactive = false,
  children,
}: {
  name: string;
  unmountWhenInactive?: boolean;
  children: ReactNode;
}) {
  const { active } = useContext(TabsContext);
  const isActive = active === name;
  if (unmountWhenInactive && !isActive) return null;
  return (
    <div hidden={!isActive} aria-hidden={!isActive}>
      {children}
    </div>
  );
}
