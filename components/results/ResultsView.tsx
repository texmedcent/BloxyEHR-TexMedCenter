"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TestTube, UserSearch } from "lucide-react";
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
        <div className="flex items-center gap-3">
          <TestTube className="h-8 w-8 text-[#1a4d8c] dark:text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Results</h1>
            <p className="text-sm text-slate-600 dark:text-muted-foreground">
              View lab, imaging, and other result types.
            </p>
          </div>
        </div>
        <Card className="border-slate-200 dark:border-border">
          <CardContent className="pt-6">
            {claimedPatients.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-muted-foreground">
                  Quick Open
                </p>
                <div className="flex flex-wrap gap-2">
                  {claimedPatients.map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        updateParams({ patientId: p.id, encounterId: undefined })
                      }
                      className="gap-1.5"
                    >
                      <UserSearch className="h-3.5 w-3.5" />
                      {p.last_name}, {p.first_name}
                    </Button>
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
      <div className="flex items-center gap-3">
        <TestTube className="h-8 w-8 text-[#1a4d8c] dark:text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold">Results</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className="font-medium text-slate-800 dark:text-foreground">
              {patient.last_name}, {patient.first_name}
            </span>
            <span className="text-sm text-slate-500 dark:text-muted-foreground">
              MRN {patient.mrn}
            </span>
            {selectedEncounterId && (
              <span className="rounded-full bg-blue-100 dark:bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:text-primary">
                Encounter filter active
              </span>
            )}
            <select
              value={filterType || ""}
              onChange={(e) => updateParams({ type: e.target.value || undefined })}
              className="rounded-lg border border-slate-300 dark:border-input bg-white dark:bg-background px-2 py-1.5 text-sm"
            >
              <option value="">All types</option>
              {RESULT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 dark:border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TestTube className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
            Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-border p-8 text-center">
              <TestTube className="mx-auto h-12 w-12 text-slate-300 dark:text-muted-foreground mb-3" />
              <p className="text-sm text-slate-500 dark:text-muted-foreground">
                No results found for this selection.
              </p>
            </div>
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
