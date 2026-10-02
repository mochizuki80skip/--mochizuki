"use client";

import { useRef, useState } from "react";

export type UploadedImage = { id: string; width: number; height: number };

// 長辺を maxWidth に縮小し JPEG 化してから送る（LINE の画像サイズ上限と Vercel のボディ上限対策）
async function resizeToJpeg(file: File, maxWidth: number): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像を処理できません");
  ctx.fillStyle = "#fff"; // 透過 PNG は白背景にする
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  for (const q of [0.88, 0.78, 0.68, 0.55]) {
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= 900 * 1024) return { blob, width, height };
  }
  throw new Error("画像が大きすぎます。小さい画像を選んでください");
}

export function ImageUploader({
  mediaId,
  maxWidth,
  onUploaded,
  onClear,
  label = "画像を選択",
}: {
  mediaId?: string;
  maxWidth: number;
  onUploaded: (img: UploadedImage) => void;
  onClear?: () => void;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const { blob, width, height } = await resizeToJpeg(file, maxWidth);
      const fd = new FormData();
      fd.append("file", new File([blob], "image.jpg", { type: "image/jpeg" }));
      fd.append("width", String(width));
      fd.append("height", String(height));
      const res = await fetch("/api/media", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "アップロードに失敗しました");
      onUploaded({ id: data.id, width, height });
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {mediaId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/media/${mediaId}`} alt="" className="h-14 w-14 object-cover rounded border" />
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="border rounded px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {busy ? "アップロード中…" : mediaId ? "画像を変更" : label}
        </button>
        {mediaId && onClear && (
          <button type="button" onClick={onClear} className="text-xs text-gray-500 hover:text-red-600">
            削除
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
