import { headers } from "next/headers";

/**
 * Resolve the public base URL of the current deployment for things like QR
 * codes. We prefer Vercel's URL hint, then the X-Forwarded-Host header, and
 * finally fall back to the localhost dev port.
 */
export function getBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "");
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}
