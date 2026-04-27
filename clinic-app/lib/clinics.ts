/**
 * Clinic registry. Names and reservation URLs come from public env vars so
 * they can be edited in Vercel without a code deploy.
 *
 * Env vars to set in Vercel (Production / Preview):
 *   NEXT_PUBLIC_CLINIC_MAIN_NAME
 *   NEXT_PUBLIC_CLINIC_MAIN_RESERVATION_URL
 *   NEXT_PUBLIC_CLINIC_BRANCH_NAME
 *   NEXT_PUBLIC_CLINIC_BRANCH_RESERVATION_URL
 */

export type ClinicId = "main" | "branch";

export type Clinic = {
  id: ClinicId;
  name: string;
  reservation_url: string;
};

const CLINICS: Clinic[] = [
  {
    id: "main",
    name: process.env.NEXT_PUBLIC_CLINIC_MAIN_NAME || "長泉三島院",
    reservation_url: process.env.NEXT_PUBLIC_CLINIC_MAIN_RESERVATION_URL || "",
  },
  {
    id: "branch",
    name: process.env.NEXT_PUBLIC_CLINIC_BRANCH_NAME || "裾野長泉院",
    reservation_url:
      process.env.NEXT_PUBLIC_CLINIC_BRANCH_RESERVATION_URL || "",
  },
];

const VALID_IDS = new Set<ClinicId>(["main", "branch"]);

export function listClinics(): Clinic[] {
  return CLINICS;
}

export function getClinic(id: string | null | undefined): Clinic | null {
  if (!id) return null;
  return CLINICS.find((c) => c.id === id) || null;
}

/**
 * Compact name suitable for badges and dense UI. Strips the brand prefix
 * "リカバリー鍼灸院" (with or without a separator) so the badge shows just
 * the location, e.g. "長泉三島院" instead of "リカバリー鍼灸院長泉三島院".
 */
export function getClinicShortName(id: string | null | undefined): string {
  const c = getClinic(id);
  if (!c) return "";
  return c.name.replace(/^リカバリー鍼灸院[\s　]*/, "");
}

export function isValidClinicId(id: string | null | undefined): id is ClinicId {
  return typeof id === "string" && VALID_IDS.has(id as ClinicId);
}
