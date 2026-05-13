"use client";

import { useState, useTransition } from "react";

type Tag = { id: string; name: string; color: string };

export function TagPicker({
  channelId,
  friendId,
  attachedTagIds,
  allTags,
}: {
  channelId: string;
  friendId: string;
  attachedTagIds: string[];
  allTags: Tag[];
}) {
  const [attached, setAttached] = useState(new Set(attachedTagIds));
  const [pending, start] = useTransition();

  function toggle(tagId: string) {
    const isOn = attached.has(tagId);
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/friends/${friendId}/tags`, {
        method: isOn ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      if (res.ok) {
        const next = new Set(attached);
        if (isOn) next.delete(tagId);
        else next.add(tagId);
        setAttached(next);
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {allTags.length === 0 && (
        <div className="text-sm text-gray-500">先にタグページでタグを作成してください。</div>
      )}
      {allTags.map((t) => {
        const on = attached.has(t.id);
        return (
          <button
            key={t.id}
            onClick={() => toggle(t.id)}
            disabled={pending}
            className="px-3 py-1 rounded text-sm border transition"
            style={{
              background: on ? t.color : "white",
              color: on ? "white" : t.color,
              borderColor: t.color,
            }}
          >
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
