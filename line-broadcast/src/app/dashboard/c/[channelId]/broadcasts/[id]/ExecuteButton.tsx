"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function ExecuteButton({ channelId, id }: { channelId: string; id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function send() {
    if (!confirm("この内容で配信しますか？")) return;
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/broadcasts/${id}/execute`, {
        method: "POST",
      });
      if (res.ok) router.refresh();
      else alert("配信に失敗しました");
    });
  }
  return (
    <button onClick={send} disabled={pending} className="bg-line text-white px-4 py-2 rounded text-sm">
      いますぐ配信する
    </button>
  );
}
