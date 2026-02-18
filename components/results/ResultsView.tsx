"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TestTube } from "lucide-react";
import { PatientSearchSelect } from "@/components/documentation/PatientSearchSelect";
import { ResultDetail } from "./ResultDetail";
import { format } from "date-fns";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
}

interface Result {
  id: string;
  type: string;
  value: unknown;
  reported_at: string;
  status: string;
  order_id: string | null;
}

interface ResultsViewProps {
  patient: Patient | null;
  results: Result[];
  filterType?: string;
}

const RESULT_TYPES = [
  "lab",
  "imaging",
  "pathology",
  "radiology",
  "med",
  "procedure",
] as const;

export function ResultsView({
  patient,
  results,
  filterType,
}: ResultsViewProps) {
  const router = useRouter();

  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (patient) params.set("patientId", patient.id);
    if (updates.patientId) params.set("patientId", updates.patientId);
    if (updates.type) params.set("type", updates.type);
    router.push(`/results?${params.toString()}`);
  };

  if (!patient) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Results Management</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-600 mb-4">
              Search for a patient to view results.
            </p>
            <PatientSearchSelect
              onSelect={(id) => updateParams({ patientId: id })}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Results Management</h1>
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-medium">
          {patient.last_name}, {patient.first_name}
        </span>
        <span className="text-sm text-gray-500">MRN: {patient.mrn}</span>
        <select
          value={filterType || ""}
          onChange={(e) =>
            updateParams({ type: e.target.value || undefined })
          }
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">All types</option>
          {RESULT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TestTube className="h-4 w-4" />
            Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-gray-500">No results found</p>
          ) : (
            <div className="space-y-4">
              {results.map((r) => (
                <ResultDetail key={r.id} result={r} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
