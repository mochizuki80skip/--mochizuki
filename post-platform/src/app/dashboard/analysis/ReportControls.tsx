"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startReportAction } from "../actions";

export function StartReportButton({ disabled }: { disabled: boolean }) {
  const [busy, start] = useTransition();
  return (
    <button onClick={() => start(() => startReportAction())} disabled={disabled || busy} className="bg-brand text-white px-3 py-1.5 rounded text-sm disabled:opacity-50">
      {disabled ? "分析中…" : "今すぐ分析"}
    </button>
  );
}

export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
