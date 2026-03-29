export const VISIT_LOCATIONS = [
  "Primary Care Office",
  "Emergency Room",
  "Urgent Care",
] as const;

export type VisitLocation = (typeof VISIT_LOCATIONS)[number];

export const DEFAULT_VISIT_TYPES = [
  "Follow-up",
  "New patient",
  "Annual wellness",
  "Sick visit",
  "Virtual visit",
] as const;

export const SPECIALTY_AND_SYMPTOM_OPTIONS = [
  "General checkup",
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "Gastroenterology",
  "Neurology",
  "Orthopedics",
  "Respiratory / cough",
  "Mental health",
  "Women's health",
  "Pediatric concern",
] as const;
