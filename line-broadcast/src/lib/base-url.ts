import type { NextRequest } from "next/server";

// LINE が画像を取得しに来る公開 URL の起点。NEXTAUTH_URL（本番ドメイン）を優先する
export function publicBaseUrl(req: NextRequest): string {
  const env = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL;
  if (env) return env.replace(/\/$/, "");
  return req.nextUrl.origin;
}
