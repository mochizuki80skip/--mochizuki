import { NextRequest } from "next/server";
import { stat, open } from "node:fs/promises";
import path from "node:path";
import { mediaDir } from "@/lib/media";

export const runtime = "nodejs";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4" };

// 生成した画像・動画の公開配信（Instagram / GBP が取りに来るためログイン不要）。動画のシーク用に Range に対応
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await params;
  const rel = path.normalize(parts.join("/"));
  const type = TYPES[path.extname(rel).toLowerCase()];
  if (rel.startsWith("..") || path.isAbsolute(rel) || !type) return new Response("not found", { status: 404 });
  const file = path.join(mediaDir(), rel);
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return new Response("not found", { status: 404 });

  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  const startByte = range?.[1] ? Number(range[1]) : 0;
  const endByte = range?.[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
  if (range && (startByte > endByte || startByte >= info.size)) {
    return new Response(null, { status: 416, headers: { "content-range": `bytes */${info.size}` } });
  }
  const fh = await open(file);
  const buf = Buffer.alloc(endByte - startByte + 1);
  await fh.read(buf, 0, buf.length, startByte);
  await fh.close();
  return new Response(buf, {
    status: range ? 206 : 200,
    headers: {
      "content-type": type,
      "content-length": String(buf.length),
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=31536000, immutable",
      ...(range ? { "content-range": `bytes ${startByte}-${endByte}/${info.size}` } : {}),
    },
  });
}
