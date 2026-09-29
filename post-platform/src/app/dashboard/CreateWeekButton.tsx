"use client";

import { useTransition } from "react";
import { createNextWeekAction } from "./actions";

export function CreateWeekButton() {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() =>
        start(async () => {
          const n = await createNextWeekAction();
          alert(n ? `翌週分を ${n} 回作成しました。各回を開いて AI 作成・承認してください。` : "翌週分はすでに作成済みです。");
        })
      }
      className="bg-brand text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
    >
      {pending ? "作成中…" : "翌週分を作成"}
    </button>
  );
}
