"use client";

import { useState, useTransition } from "react";

export function NotesEditor({ friendId, initial }: { friendId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      const res = await fetch(`/api/friends/${friendId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full border rounded px-3 py-2 text-sm min-h-24"
        placeholder="この友だちに関するメモ"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={pending}
          className="bg-line text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
        >
          保存
        </button>
        {saved && <span className="text-xs text-line-dark">保存しました</span>}
      </div>
    </div>
  );
}
