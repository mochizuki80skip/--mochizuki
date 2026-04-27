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
    name: process.env.NEXT_PUBLIC_CLINIC_MAIN_NAME || "リカバリー鍼灸院 1号店",
    reservation_url: process.env.NEXT_PUBLIC_CLINIC_MAIN_RESERVATION_URL || "",
  },
  {
    id: "branch",
    name: process.env.NEXT_PUBLIC_CLINIC_BRANCH_NAME || "リカバリー鍼灸院 2号店",
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

export function isValidClinicId(id: string | null | undefined): id is ClinicId {
  return typeof id === "string" && VALID_IDS.has(id as ClinicId);
}
