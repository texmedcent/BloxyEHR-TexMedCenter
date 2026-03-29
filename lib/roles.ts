import type { SupabaseClient } from "@supabase/supabase-js";

export type AppRole =
  | "patient"
  | "hospital_manager"
  | "chief_medical_officer"
  | "attending_physician"
  | "medical_doctor"
  | "resident_physician"
  | "nurse_practitioner"
  | "physician_assistant"
  | "registered_nurse"
  | "nurse"
  | "licensed_practical_nurse"
  | "radiologist"
  | "pharmacist"
  | "lab_technician"
  | "respiratory_therapist"
  | "physical_therapist"
  | "unit_clerk"
  | "admin_staff";

export const ALL_ROLES: AppRole[] = [
  "patient",
  "hospital_manager",
  "chief_medical_officer",
  "attending_physician",
  "medical_doctor",
  "resident_physician",
  "nurse_practitioner",
  "physician_assistant",
  "registered_nurse",
  "nurse",
  "licensed_practical_nurse",
  "radiologist",
  "pharmacist",
  "lab_technician",
  "respiratory_therapist",
  "physical_therapist",
  "unit_clerk",
  "admin_staff",
];

export const STAFF_ROLES: AppRole[] = ALL_ROLES.filter(
  (role) => role !== "patient"
) as AppRole[];

export type AppPermission =
  | "place_order"
  | "start_encounter"
  | "edit_encounter"
  | "finalize_encounter"
  | "submit_treatment_plan"
  | "acknowledge_result"
  | "set_disposition"
  | "complete_handoff"
  | "finalize_procedure_note"
  | "create_inbasket_task"
  | "review_adverse_event"
  | "cosign_note"
  | "verify_pharmacy_order";

export const CLINICAL_PROVIDER_ROLES: AppRole[] = [
  "hospital_manager",
  "chief_medical_officer",
  "attending_physician",
  "medical_doctor",
  "resident_physician",
  "nurse_practitioner",
  "physician_assistant",
];

export const CLINICAL_STAFF_ROLES: AppRole[] = [
  ...CLINICAL_PROVIDER_ROLES,
  "registered_nurse",
  "nurse",
  "licensed_practical_nurse",
  "radiologist",
  "pharmacist",
  "lab_technician",
  "respiratory_therapist",
  "physical_therapist",
];

const ROLE_PERMISSIONS: Record<AppPermission, AppRole[]> = {
  place_order: CLINICAL_PROVIDER_ROLES,
  start_encounter: CLINICAL_STAFF_ROLES,
  edit_encounter: CLINICAL_STAFF_ROLES,
  finalize_encounter: CLINICAL_PROVIDER_ROLES,
  submit_treatment_plan: CLINICAL_PROVIDER_ROLES,
  acknowledge_result: CLINICAL_STAFF_ROLES,
  set_disposition: CLINICAL_PROVIDER_ROLES,
  complete_handoff: CLINICAL_STAFF_ROLES,
  finalize_procedure_note: CLINICAL_PROVIDER_ROLES,
  create_inbasket_task: CLINICAL_STAFF_ROLES,
  review_adverse_event: ["hospital_manager", "chief_medical_officer", "attending_physician"],
  cosign_note: CLINICAL_PROVIDER_ROLES,
  verify_pharmacy_order: ["pharmacist"],
};

const ROLE_LABELS: Record<AppRole, string> = {
  patient: "Patient",
  hospital_manager: "Hospital Manager",
  chief_medical_officer: "Chief Medical Officer",
  attending_physician: "Attending Physician",
  medical_doctor: "Medical Doctor",
  resident_physician: "Resident Physician",
  nurse_practitioner: "Nurse Practitioner",
  physician_assistant: "Physician Assistant",
  registered_nurse: "Registered Nurse",
  nurse: "Nurse",
  licensed_practical_nurse: "Licensed Practical Nurse",
  radiologist: "Radiologist",
  pharmacist: "Pharmacist",
  lab_technician: "Lab Technician",
  respiratory_therapist: "Respiratory Therapist",
  physical_therapist: "Physical Therapist",
  unit_clerk: "Unit Clerk",
  admin_staff: "Administrative Staff",
};

export function getRoleLandingPath(role: string | null | undefined): string {
  if (!role || role === "patient") return "/patient";
  return "/staff-dashboard";
}

export function isHospitalManager(role: string | null | undefined): boolean {
  return role === "hospital_manager";
}

export function isPharmacist(role: string | null | undefined): boolean {
  return role === "pharmacist";
}

export function hasRolePermission(
  role: string | null | undefined,
  permission: AppPermission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[permission].includes(role as AppRole);
}

/** Non-patient staff must have a department (institution_departments) before using the clinical workspace. */
export function staffMustSelectDepartment(role: string | null | undefined): boolean {
  return Boolean(role && role !== "patient");
}

export function formatRoleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  if ((role as AppRole) in ROLE_LABELS) {
    return ROLE_LABELS[role as AppRole];
  }
  return role.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Canonical account that always receives hospital_manager (matches DB triggers / migrations). */
export const HOSPITAL_MANAGER_BOOTSTRAP_EMAIL = "dylanmwoodruff@icloud.com";

export function isBootstrapHospitalManagerEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === HOSPITAL_MANAGER_BOOTSTRAP_EMAIL;
}

/** Prefer bootstrap over stored profile role so landing + RLS stay aligned. */
export function resolveRoleWithBootstrap(
  email: string | null | undefined,
  profileRole: string | null | undefined,
): string | null {
  if (isBootstrapHospitalManagerEmail(email)) return "hospital_manager";
  return profileRole ?? null;
}

/** Ensures profiles.role is hospital_manager for the bootstrap email (RLS allows own-row update). */
export async function persistBootstrapHospitalManagerRole(
  supabase: SupabaseClient,
  userId: string,
  email: string | null | undefined,
  profileRole: string | null | undefined,
): Promise<void> {
  if (!isBootstrapHospitalManagerEmail(email) || profileRole === "hospital_manager") return;
  await supabase.from("profiles").update({ role: "hospital_manager" }).eq("id", userId);
}

/** Create or update the caller's profile row so server layouts can authorize by role. */
export async function ensureProfileRecord(
  supabase: SupabaseClient,
  userId: string,
  email: string | null,
  fullName: string | null,
  role: string,
): Promise<void> {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      role,
    },
    { onConflict: "id" },
  );
  if (!error) return;

  // If email is already used by a stale/legacy profile row, create/update this user's row without email.
  // This keeps auth flow unblocked; email can be reconciled separately in admin/settings.
  await supabase.from("profiles").upsert(
    {
      id: userId,
      email: null,
      full_name: fullName,
      role,
    },
    { onConflict: "id" },
  );
}
