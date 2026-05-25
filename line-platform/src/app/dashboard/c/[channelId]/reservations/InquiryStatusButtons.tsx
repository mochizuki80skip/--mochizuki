"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function InquiryStatusButtons({
  channelId,
  inquiryId,
  status,
}: {
  channelId: string;
  inquiryId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function setStatus(next: string) {
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/reservations/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    });
  }

  if (status === "pending") {
    return (
      <div className="flex gap-1 justify-end">
        <button
          onClick={() => setStatus("handled")}
          disabled={pending}
          className="bg-line text-white text-xs px-2 py-1 rounded disabled:opacity-50"
        >
          対応済にする
        </button>
        <button
          onClick={() => setStatus("cancelled")}
          disabled={pending}
          className="border text-gray-600 text-xs px-2 py-1 rounded disabled:opacity-50"
        >
          キャンセル
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setStatus("pending")}
      disabled={pending}
      className="border text-gray-500 text-xs px-2 py-1 rounded disabled:opacity-50"
    >
      未対応に戻す
    </button>
  );
}
