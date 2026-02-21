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
        "flex flex-wrap items-center gap-4 px-3 py-2 bg-white dark:bg-muted border rounded-md shadow-sm text-sm dark:border-[hsl(var(--border))]",
        className
      )}
    >
      <span className="font-semibold text-slate-900 dark:text-foreground">
        {patient.last_name}, {patient.first_name}
      </span>
      <span className="text-slate-500 dark:text-muted-foreground">
        DOB: {patient.dob ? format(new Date(patient.dob), "MM/dd/yyyy") : "—"}
      </span>
      <span className="text-slate-500 dark:text-muted-foreground">MRN: {patient.mrn}</span>
      <span className="text-slate-500 dark:text-muted-foreground">
        {patient.gender || "—"}
      </span>
      {allergyList.length > 0 && (
        <span className="text-amber-700 dark:text-amber-400 font-medium">
          Allergies: {allergyList.join(", ")}
        </span>
      )}
    </div>
  );
}
