import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string | null;
  allergies?: unknown;
}

interface PatientSummaryBarProps {
  patient: Patient;
  className?: string;
}

export function PatientSummaryBar({ patient, className }: PatientSummaryBarProps) {
  const allergyList = Array.isArray(patient.allergies)
    ? (patient.allergies as { allergen?: string }[])
        .map((a) => a.allergen)
        .filter(Boolean)
    : [];

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 px-3 py-2 bg-white border rounded-md shadow-sm text-sm",
        className
      )}
    >
      <span className="font-semibold text-slate-900">
        {patient.last_name}, {patient.first_name}
      </span>
      <span className="text-slate-500">
        DOB: {patient.dob ? format(new Date(patient.dob), "MM/dd/yyyy") : "—"}
      </span>
      <span className="text-slate-500">MRN: {patient.mrn}</span>
      <span className="text-slate-500">
        {patient.gender || "—"}
      </span>
      {allergyList.length > 0 && (
        <span className="text-amber-700 font-medium">
          Allergies: {allergyList.join(", ")}
        </span>
      )}
    </div>
  );
}
