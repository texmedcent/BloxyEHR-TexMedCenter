"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, UserSearch } from "lucide-react";
import { PatientSearchSelect } from "@/components/documentation/PatientSearchSelect";
import { format } from "date-fns";
import { formatOrderDetails } from "@/lib/orders";
import { OrderResultForm } from "@/components/orders/OrderResultForm";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
}

interface ProcedureOrder {
  id: string;
  type: string;
  status: string;
  ordered_at: string;
  details: unknown;
  patient_id: string;
  encounter_id: string | null;
}

interface ProceduresViewProps {
  patient: Patient | null;
  procedures: ProcedureOrder[];
  narrativeByOrderId: Record<
    string,
    { id: string; status: string; value: unknown; reported_at: string }
  >;
  claimedPatients: Patient[];
  selectedEncounterId: string | null;
}

function narrativePreview(value: unknown): string {
  if (!value) return "—";
  if (typeof value === "string") return value;
  if (
    typeof value === "object" &&
    value !== null &&
    (value as { format?: unknown }).format === "procedure_note_v1"
  ) {
    const record = value as {
      procedure_name?: unknown;
      post_op_diagnosis?: unknown;
      findings?: unknown;
      technique?: unknown;
    };
    const parts = [
      typeof record.procedure_name === "string" ? record.procedure_name : "",
      typeof record.post_op_diagnosis === "string" ? `Dx: ${record.post_op_diagnosis}` : "",
      typeof record.findings === "string" ? `Findings: ${record.findings}` : "",
      typeof record.technique === "string" ? record.technique : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }
  if (typeof value === "object" && value !== null && "note" in value) {
    const note = (value as { note?: unknown }).note;
    return typeof note === "string" && note.trim() ? note : "—";
  }
  return JSON.stringify(value);
}

export function ProceduresView({
  patient,
  procedures,
  narrativeByOrderId,
  claimedPatients,
  selectedEncounterId,
}: ProceduresViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedProcedureForNote, setSelectedProcedureForNote] =
    useState<ProcedureOrder | null>(null);

  const updateParams = (patientId: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("patientId", patientId);
    params.delete("encounterId");
    router.push(`/procedures?${params.toString()}`);
  };

  if (!patient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-[#1a4d8c] dark:text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Procedures</h1>
            <p className="text-sm text-slate-600 dark:text-muted-foreground">
              View ordered procedures and add narrative entries.
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
                      onClick={() => updateParams(p.id)}
                      className="gap-1.5"
                    >
                      <UserSearch className="h-3.5 w-3.5" />
                      {p.last_name}, {p.first_name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <PatientSearchSelect onSelect={updateParams} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-8 w-8 text-[#1a4d8c] dark:text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold">Procedures</h1>
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
          </div>
        </div>
      </div>

      <Card className="border-slate-200 dark:border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
            Ordered Procedures
          </CardTitle>
        </CardHeader>
        <CardContent>
          {procedures.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 dark:border-border p-8 text-center">
              <ClipboardCheck className="mx-auto h-12 w-12 text-slate-300 dark:text-muted-foreground mb-3" />
              <p className="text-sm text-slate-500 dark:text-muted-foreground">
                No procedure orders found for this selection.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/50">
                    <th className="py-2.5 pr-4 pl-3 text-left font-semibold text-slate-700 dark:text-foreground">
                      Procedure
                    </th>
                    <th className="py-2.5 pr-4 text-left font-semibold text-slate-700 dark:text-foreground">
                      Status
                    </th>
                    <th className="py-2.5 pr-4 text-left font-semibold text-slate-700 dark:text-foreground">
                      Ordered
                    </th>
                    <th className="py-2.5 pr-4 text-left font-semibold text-slate-700 dark:text-foreground">
                      Narrative
                    </th>
                    <th className="py-2.5 pr-3 text-left font-semibold text-slate-700 dark:text-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {procedures.map((procedureOrder) => (
                    <tr
                      key={procedureOrder.id}
                      className="border-b border-slate-200 dark:border-border last:border-0 hover:bg-slate-50 dark:hover:bg-muted/30"
                    >
                      <td className="py-2.5 pr-4 pl-3 font-medium">
                        {formatOrderDetails("procedure", procedureOrder.details)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="rounded-full bg-slate-100 dark:bg-muted px-2 py-0.5 text-xs capitalize">
                          {procedureOrder.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-slate-500 dark:text-muted-foreground">
                        {format(new Date(procedureOrder.ordered_at), "MMM d, yyyy HH:mm")}
                      </td>
                      <td className="py-2.5 pr-4 text-slate-600 dark:text-muted-foreground max-w-[200px]">
                        <span className="line-clamp-2">
                          {narrativePreview(narrativeByOrderId[procedureOrder.id]?.value)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setSelectedProcedureForNote(procedureOrder)}
                        >
                          {narrativeByOrderId[procedureOrder.id]
                            ? "Update Narrative"
                            : "Add Narrative"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProcedureForNote && (
        <OrderResultForm
          order={selectedProcedureForNote}
          existingResult={narrativeByOrderId[selectedProcedureForNote.id]}
          mode="note"
          onClose={() => setSelectedProcedureForNote(null)}
          onSaved={() => {
            setSelectedProcedureForNote(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
