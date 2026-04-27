import { cookies } from "next/headers";
import crypto from "crypto";

const ADMIN_COOKIE = "kc_admin";
const PATIENT_COOKIE = "kc_patient";
const ADMIN_MAX_AGE = 60 * 60 * 8;          // 8 hours
const PATIENT_MAX_AGE = 60 * 60 * 24 * 30;  // 30 days

export type AdminRole = "master" | "main" | "branch";

const ADMIN_VALUES = new Set<string>(["master", "main", "branch"]);

function getSecret(): string {
  // We sign cookies with whichever password is available; the value of the
  // secret doesn't need to be predictable, only consistent across the same
  // server. ADMIN_PASSWORD_MASTER is preferred, falling back through the
  // other keys, then the legacy single password.
  return (
    process.env.ADMIN_PASSWORD_MASTER ||
    process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD_MAIN ||
    process.env.ADMIN_PASSWORD_BRANCH ||
    "kc-dev-secret-do-not-use"
  );
}

function sign(value: string): string {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
}

function pack(value: string): string {
  return `${value}.${sign(value)}`;
}

function unpack(packed: string | undefined): string | null {
  if (!packed) return null;
  const i = packed.lastIndexOf(".");
  if (i < 0) return null;
  const value = packed.slice(0, i);
  const sig = packed.slice(i + 1);
  if (!value || !sig) return null;
  const expected = sign(value);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  return value;
}

const baseOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// --- Admin ----------------------------------------------------------------

export function setAdminCookie(role: AdminRole) {
  cookies().set(ADMIN_COOKIE, pack(role), {
    ...baseOpts,
    maxAge: ADMIN_MAX_AGE,
  });
}

export function clearAdminCookie() {
  cookies().delete(ADMIN_COOKIE);
}

export function getAdminRole(): AdminRole | null {
  const v = unpack(cookies().get(ADMIN_COOKIE)?.value);
  if (!v) return null;
  // Backward compatibility: legacy cookies stored "admin" — treat as master.
  if (v === "admin") return "master";
  return ADMIN_VALUES.has(v) ? (v as AdminRole) : null;
}

export function isAdminAuthenticated(): boolean {
  return getAdminRole() !== null;
}

function timingEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Check the entered password against the configured roles. Returns the
 * matching role, or null if no password matches.
 *
 * The legacy ADMIN_PASSWORD env var is treated as the master password so
 * existing deployments continue to work without env-var churn.
 */
export function checkAdminPassword(input: string): AdminRole | null {
  if (!input) return null;
  const candidates: Array<[AdminRole, string | undefined]> = [
    ["master", process.env.ADMIN_PASSWORD_MASTER],
    ["master", process.env.ADMIN_PASSWORD], // legacy fallback
    ["main", process.env.ADMIN_PASSWORD_MAIN],
    ["branch", process.env.ADMIN_PASSWORD_BRANCH],
  ];
  for (const [role, expected] of candidates) {
    if (!expected) continue;
    if (timingEqual(input, expected)) return role;
  }
  return null;
}

// --- Patient --------------------------------------------------------------

export function setPatientCookie(patientId: string) {
  cookies().set(PATIENT_COOKIE, pack(patientId), {
    ...baseOpts,
    maxAge: PATIENT_MAX_AGE,
  });
}

export function clearPatientCookie() {
  cookies().delete(PATIENT_COOKIE);
}

export function getAuthenticatedPatientId(): string | null {
  return unpack(cookies().get(PATIENT_COOKIE)?.value);
}
