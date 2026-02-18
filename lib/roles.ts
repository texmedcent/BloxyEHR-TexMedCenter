export type AppRole =
  | "patient"
  | "hospital_manager"
  | "medical_doctor"
  | "physician_assistant"
  | "nurse"
  | "radiologist"
  | "pharmacist"
  | "lab_technician"
  | "admin_staff";

export const STAFF_ROLES: AppRole[] = [
  "hospital_manager",
  "medical_doctor",
  "physician_assistant",
  "nurse",
  "radiologist",
  "pharmacist",
  "lab_technician",
  "admin_staff",
];

export function getRoleLandingPath(role: string | null | undefined): string {
  if (!role || role === "patient") return "/patient";
  return "/dashboard";
}

export function isHospitalManager(role: string | null | undefined): boolean {
  return role === "hospital_manager";
}
