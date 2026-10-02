import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_BYTES = 3 * 1024 * 1024; // Vercel の 4.5MB 上限に余裕を持たせる
const ALLOWED = new Set(["image/jpeg", "image/png"]);

// 配信画像のアップロード（クライアントでリサイズ済みの JPEG/PNG を想定）
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file がありません" }, { status: 400 });
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "JPEG / PNG のみアップロードできます" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "画像が大きすぎます（3MB まで）" }, { status: 413 });
  }
  const num = (k: string) => {
    const n = Number(form.get(k));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };

  const media = await prisma.media.create({
    data: {
      contentType: file.type,
      data: Buffer.from(await file.arrayBuffer()),
      width: num("width"),
      height: num("height"),
    },
    select: { id: true, width: true, height: true },
  });
  return NextResponse.json(media);
}
