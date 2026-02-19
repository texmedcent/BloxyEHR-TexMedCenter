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
  | "cosign_note";

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
  return "/dashboard";
}

export function isHospitalManager(role: string | null | undefined): boolean {
  return role === "hospital_manager";
}

export function hasRolePermission(
  role: string | null | undefined,
  permission: AppPermission
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[permission].includes(role as AppRole);
}

export function formatRoleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  if ((role as AppRole) in ROLE_LABELS) {
    return ROLE_LABELS[role as AppRole];
  }
  return role.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
