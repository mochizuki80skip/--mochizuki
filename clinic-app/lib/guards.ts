import { redirect } from "next/navigation";
import {
  getAuthenticatedPatientId,
  isAdminAuthenticated,
} from "./auth";
import { getPatientById } from "./db";
import type { Patient } from "./types";

export function requireAdmin() {
  if (!isAdminAuthenticated()) {
    redirect("/admin/login");
  }
}

export async function requirePatient(): Promise<Patient> {
  const id = getAuthenticatedPatientId();
  if (!id) redirect("/me");
  const patient = await getPatientById(id);
  if (!patient) redirect("/me");
  return patient;
}
