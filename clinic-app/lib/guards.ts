import { redirect } from "next/navigation";
import {
  getAdminRole,
  getAuthenticatedPatientId,
  type AdminRole,
} from "./auth";
import { getPatientById } from "./db";
import type { Patient } from "./types";

export type AdminContext = {
  role: AdminRole;
  /**
   * The clinic this admin is scoped to. Null only for the master role,
   * which can see every patient (including unassigned ones).
   */
  clinicId: "main" | "branch" | null;
};

export function getAdminContext(): AdminContext | null {
  const role = getAdminRole();
  if (!role) return null;
  return {
    role,
    clinicId: role === "master" ? null : (role as "main" | "branch"),
  };
}

export function requireAdmin(): AdminContext {
  const ctx = getAdminContext();
  if (!ctx) redirect("/admin/login");
  return ctx;
}

/** Master-only operations (delete patient, transfer between clinics). */
export function requireMaster(): AdminContext {
  const ctx = requireAdmin();
  if (ctx.role !== "master") redirect("/admin/forbidden");
  return ctx;
}

/**
 * True if the admin can read/write this patient.
 * - master: any patient (including unassigned)
 * - clinic admin: only patients whose clinic_id matches their role
 */
export function canAccessPatient(
  patient: Patient | null | undefined,
  ctx: AdminContext,
): boolean {
  if (!patient) return false;
  if (ctx.role === "master") return true;
  return patient.clinic_id === ctx.clinicId;
}

export async function requirePatient(): Promise<Patient> {
  const id = getAuthenticatedPatientId();
  if (!id) redirect("/me");
  const patient = await getPatientById(id);
  if (!patient) redirect("/me");
  return patient;
}
