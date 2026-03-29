export type CareSetting = "outpatient" | "inpatient";

export type CampusOption = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export const FALLBACK_CAMPUSES: CampusOption[] = [
  { id: "fallback-primary-care", name: "Primary Care Office", sort_order: 10, is_active: true },
  { id: "fallback-emergency", name: "Emergency Room", sort_order: 20, is_active: true },
  { id: "fallback-urgent-care", name: "Urgent Care", sort_order: 30, is_active: true },
];

export function careSettingToEncounterType(careSetting: string | null | undefined): "outpatient" | "inpatient" {
  return (careSetting || "").toLowerCase() === "inpatient" ? "inpatient" : "outpatient";
}

export function normalizeCareSetting(raw: string | null | undefined): CareSetting {
  return (raw || "").toLowerCase() === "inpatient" ? "inpatient" : "outpatient";
}
