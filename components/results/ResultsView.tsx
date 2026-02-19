"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TestTube } from "lucide-react";
import { PatientSearchSelect } from "@/components/documentation/PatientSearchSelect";
import { ResultDetail } from "./ResultDetail";

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
  acknowledgment_status?: string;
  acknowledged_by_name?: string | null;
  acknowledged_at?: string | null;
  actioned_by_name?: string | null;
  actioned_at?: string | null;
  is_critical?: boolean;
  critical_reason?: string | null;
  reviewed_note?: string | null;
  action_note?: string | null;
  critical_callback_documented?: boolean;
  critical_callback_documented_at?: string | null;
  critical_callback_documented_by_name?: string | null;
  reviewed_latency_minutes?: number | null;
  action_latency_minutes?: number | null;
  escalation_triggered_at?: string | null;
  escalation_recipient_name?: string | null;
  sla_violation_reviewed?: boolean;
  sla_violation_actioned?: boolean;
  released_to_patient?: boolean;
  patient_release_hold?: boolean;
  patient_release_hold_reason?: string | null;
}

interface ResultsViewProps {
  patient: Patient | null;
  results: Result[];
  filterType?: string;
  claimedPatients: Patient[];
  selectedEncounterId: string | null;
  currentUserRole: string | null;
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
  claimedPatients,
  selectedEncounterId,
  currentUserRole,
}: ResultsViewProps) {
  const router = useRouter();

  const updateParams = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (patient) params.set("patientId", patient.id);
    if (updates.patientId) params.set("patientId", updates.patientId);
    if (selectedEncounterId && !updates.patientId) {
      params.set("encounterId", selectedEncounterId);
    }
    if (updates.encounterId) params.set("encounterId", updates.encounterId);
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
            {claimedPatients.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Quick Open Claimed Patients
                </p>
                <div className="flex flex-wrap gap-2">
                  {claimedPatients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="inline-flex h-8 items-center rounded border border-slate-300 bg-white px-2 text-xs hover:bg-slate-50"
                      onClick={() =>
                        updateParams({ patientId: p.id, encounterId: undefined })
                      }
                    >
                      {p.last_name}, {p.first_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <PatientSearchSelect
              onSelect={(id) => updateParams({ patientId: id, encounterId: undefined })}
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
        {selectedEncounterId && (
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
            Encounter Filter Active
          </span>
        )}
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
                <ResultDetail key={r.id} result={r} currentUserRole={currentUserRole} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
