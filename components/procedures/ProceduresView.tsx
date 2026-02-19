"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck } from "lucide-react";
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
        <h1 className="text-2xl font-semibold">Procedures</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="mb-4 text-gray-600">
              Search for a patient to view ordered procedures and narrative entries.
            </p>
            {claimedPatients.length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Quick Open Claimed Patients
                </p>
                <div className="flex flex-wrap gap-2">
                  {claimedPatients.map((p) => (
                    <Button
                      key={p.id}
                      size="sm"
                      variant="outline"
                      onClick={() => updateParams(p.id)}
                    >
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
      <h1 className="text-2xl font-semibold">Procedures</h1>
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-medium">
          {patient.last_name}, {patient.first_name}
        </span>
        <span className="text-sm text-gray-500">MRN: {patient.mrn}</span>
        {selectedEncounterId && (
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
            Encounter Filter Active
          </span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" />
            Ordered Procedures
          </CardTitle>
        </CardHeader>
        <CardContent>
          {procedures.length === 0 ? (
            <p className="text-sm text-gray-500">
              No procedure orders found for this selection.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left">Procedure</th>
                    <th className="py-2 pr-4 text-left">Status</th>
                    <th className="py-2 pr-4 text-left">Ordered</th>
                    <th className="py-2 pr-4 text-left">Narrative</th>
                    <th className="py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {procedures.map((procedureOrder) => (
                    <tr key={procedureOrder.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        {formatOrderDetails("procedure", procedureOrder.details)}
                      </td>
                      <td className="py-2 pr-4 capitalize">{procedureOrder.status}</td>
                      <td className="py-2 pr-4 text-gray-500">
                        {format(new Date(procedureOrder.ordered_at), "MM/dd/yyyy HH:mm")}
                      </td>
                      <td className="py-2 pr-4 text-slate-600">
                        <span className="line-clamp-2">
                          {narrativePreview(narrativeByOrderId[procedureOrder.id]?.value)}
                        </span>
                      </td>
                      <td className="py-2">
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
