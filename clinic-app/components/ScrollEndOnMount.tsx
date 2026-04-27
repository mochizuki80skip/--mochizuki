"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Tiny client wrapper that scrolls its overflow-x container all the way to
 * the right on first paint. Used by horizontal timelines (e.g. the 14-day
 * heatmap) so the most recent day is in view by default.
 */
export default function ScrollEndOnMount({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
