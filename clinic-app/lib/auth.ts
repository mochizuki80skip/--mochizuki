import { cookies } from "next/headers";
import crypto from "crypto";

const ADMIN_COOKIE = "kc_admin";
const PATIENT_COOKIE = "kc_patient";
const ADMIN_MAX_AGE = 60 * 60 * 8;          // 8 hours
const PATIENT_MAX_AGE = 60 * 60 * 24 * 30;  // 30 days

function getSecret(): string {
  // ADMIN_PASSWORD doubles as the HMAC secret. If unset, we fall back to a
  // dev-only marker — production envs always have it.
  return process.env.ADMIN_PASSWORD || "kc-dev-secret-do-not-use";
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

export function setAdminCookie() {
  cookies().set(ADMIN_COOKIE, pack("admin"), {
    ...baseOpts,
    maxAge: ADMIN_MAX_AGE,
  });
}

export function clearAdminCookie() {
  cookies().delete(ADMIN_COOKIE);
}

export function isAdminAuthenticated(): boolean {
  return unpack(cookies().get(ADMIN_COOKIE)?.value) === "admin";
}

export function checkAdminPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  if (input.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected));
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
