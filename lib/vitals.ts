function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function isOutOfRange(value: number, min: number, max: number): boolean {
  return value < min || value > max;
}

function normalizeType(type: string): string {
  return type.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function isAbnormalVital(type: string, value: string, unit?: string | null): boolean {
  const normalizedType = normalizeType(type);
  const normalizedUnit = (unit || "").trim().toLowerCase();

  if (!value.trim()) return false;

  if (normalizedType === "blood_pressure") {
    const match = value.trim().match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
    if (!match) return false;
    const systolic = Number(match[1]);
    const diastolic = Number(match[2]);
    return isOutOfRange(systolic, 90, 140) || isOutOfRange(diastolic, 60, 90);
  }

  const numeric = parseNumber(value);
  if (numeric === null) return false;

  switch (normalizedType) {
    case "heart_rate":
      return isOutOfRange(numeric, 60, 100);
    case "respiratory_rate":
      return isOutOfRange(numeric, 12, 20);
    case "temperature":
      if (normalizedUnit === "c" || normalizedUnit === "celsius") {
        return isOutOfRange(numeric, 36.1, 38);
      }
      return isOutOfRange(numeric, 97, 100.4);
    case "spo2":
      return numeric < 95;
    case "pain_score":
      return numeric >= 4;
    default:
      return false;
  }
}
