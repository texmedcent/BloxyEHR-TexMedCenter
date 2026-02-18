type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function stringField(record: JsonRecord | null, key: string): string {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
}

export function formatOrderDetails(type: string, details: unknown): string {
  const record = asRecord(details);
  if (!record) return "—";

  if (type === "med") {
    const medication = stringField(record, "medication");
    const dose = stringField(record, "dose");
    const route = stringField(record, "route");
    const frequency = stringField(record, "frequency");
    const duration = stringField(record, "duration");
    const indication = stringField(record, "indication");

    const left = [medication, dose, route, frequency].filter(Boolean).join(" ");
    const right = [duration ? `x${duration}` : "", indication ? `for ${indication}` : ""]
      .filter(Boolean)
      .join(" ");
    return [left, right].filter(Boolean).join(" · ") || "Medication order";
  }

  const note = stringField(record, "note");
  if (note) return note;

  return JSON.stringify(record);
}

export function getMedicationName(details: unknown): string {
  const record = asRecord(details);
  return stringField(record, "medication");
}
