import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, clearGoogleTokenCache } from "@/lib/google";
import { requireUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  await requireUser();
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/settings?google=${q}`, process.env.NEXTAUTH_URL));

  const state = url.searchParams.get("state");
  if (!state || state !== req.cookies.get("g_state")?.value) return back("state_error");
  const code = url.searchParams.get("code");
  if (!code) return back(url.searchParams.get("error") ?? "cancelled");

  const { refreshToken, email } = await exchangeCode(code);
  if (!refreshToken) return back("no_refresh_token");

  await prisma.googleConnection.upsert({
    where: { id: "default" },
    create: { refreshToken: encrypt(refreshToken), email },
    update: { refreshToken: encrypt(refreshToken), email, connectedAt: new Date() },
  });
  clearGoogleTokenCache();
  const res = back("ok");
  res.cookies.delete("g_state");
  return res;
}
