"use client";

import { useState } from "react";

export default function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select-all the textarea so the user can copy manually.
      const ta = document.getElementById("copy-summary-text");
      if (ta instanceof HTMLTextAreaElement) {
        ta.focus();
        ta.select();
      }
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="rounded-full bg-ink-900 text-white font-bold text-xs px-4 py-2 hover:bg-ink-800 transition"
    >
      {copied ? "コピーしました" : "テキストをコピー"}
    </button>
  );
}
