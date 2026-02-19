"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Stethoscope } from "lucide-react";
import { NoteEditor } from "./NoteEditor";
import { PatientSearchSelect } from "./PatientSearchSelect";
import { CreateEncounterButton } from "./CreateEncounterButton";
import { VitalsRecorder } from "./VitalsRecorder";
import { NoteDetailModal } from "./NoteDetailModal";
import { EncounterDiagnosisPanel } from "./EncounterDiagnosisPanel";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { formatRoleLabel, hasRolePermission } from "@/lib/roles";
import { NursingFlowsheetPanel } from "./NursingFlowsheetPanel";
import { HandoffPanel } from "./HandoffPanel";

interface Patient {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
}

interface Encounter {
  id: string;
  type: string;
  admit_date: string | null;
  status: string;
  differential_diagnosis: string | null;
  final_diagnosis_code: string | null;
  final_diagnosis_description: string | null;
  final_treatment_plan: string | null;
}

interface Note {
  id: string;
  type: string;
  content: string;
  signed_at: string | null;
  created_at: string;
  encounter_id: string;
  requires_cosign?: boolean;
  cosign_status?: string;
  cosigned_by_name?: string | null;
  cosigned_at?: string | null;
  is_addendum?: boolean;
  parent_note_id?: string | null;
  addendum_reason?: string | null;
  released_to_patient?: boolean;
  patient_release_hold?: boolean;
  patient_release_hold_reason?: string | null;
}

interface VitalSign {
  id: string;
  type: string;
  value: string;
  unit: string | null;
  recorded_at: string;
}

interface DocumentationViewProps {
  patient: Patient | null;
  encounters: Encounter[];
  notes: Note[];
  vitals: VitalSign[];
  claimedPatients: Patient[];
  selectedEncounterId?: string;
  currentUserRole: string | null;
}

export function DocumentationView({
  patient,
  encounters,
  notes,
  vitals,
  claimedPatients,
  selectedEncounterId,
  currentUserRole,
}: DocumentationViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showEditor, setShowEditor] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [cosigningNoteId, setCosigningNoteId] = useState<string | null>(null);

  const [creatingEncounter, setCreatingEncounter] = useState(false);
  const selectedEncounter =
    encounters.find((e) => e.id === selectedEncounterId) || null;
  const canCosign = hasRolePermission(currentUserRole, "cosign_note");

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    router.push(`/documentation?${params.toString()}`);
  };

  const requestCosign = async (note: Note) => {
    const supabase = createClient();
    await supabase
      .from("clinical_notes")
      .update({ requires_cosign: true, cosign_status: "pending" })
      .eq("id", note.id);
    router.refresh();
  };

  const cosignNote = async (note: Note) => {
    if (!canCosign) return;
    setCosigningNoteId(note.id);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCosigningNoteId(null);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    await supabase
      .from("clinical_notes")
      .update({
        cosign_status: "co_signed",
        cosigned_by: user.id,
        cosigned_by_name: profile?.full_name || user.email || "Clinician",
        cosigned_at: new Date().toISOString(),
      })
      .eq("id", note.id);
    setCosigningNoteId(null);
    router.refresh();
  };

  if (!patient) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Clinical Documentation</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-600 mb-4">
              Search for a patient to view and add clinical notes.
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
                      onClick={() => updateParams({ patientId: p.id, encounterId: "" })}
                    >
                      {p.last_name}, {p.first_name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <PatientSearchSelect
              onSelect={(id) => updateParams({ patientId: id, encounterId: "" })}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Clinical Documentation</h1>
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4" />
              Encounters
            </CardTitle>
          </CardHeader>
          <CardContent>
            {encounters.length === 0 ? (
              <CreateEncounterButton
                patientId={patient.id}
                onCreated={(encId) => {
                  updateParams({ patientId: patient.id, encounterId: encId });
                  setCreatingEncounter(false);
                }}
                isLoading={creatingEncounter}
                onLoadingChange={setCreatingEncounter}
              />
            ) : (
              <ul className="space-y-2">
                {encounters.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() =>
                        updateParams({
                          patientId: patient.id,
                          encounterId: e.id,
                        })
                      }
                      className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                        selectedEncounterId === e.id
                          ? "border-[#1a4d8c] bg-[#1a4d8c]/5"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <span className="font-medium capitalize">{e.type}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {e.admit_date
                          ? format(new Date(e.admit_date), "MM/dd/yyyy")
                          : "—"}{" "}
                        · {e.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </CardTitle>
            {selectedEncounterId && (
              <Button size="sm" onClick={() => setShowEditor(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add Note
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedEncounterId ? (
              notes.length === 0 ? (
                <p className="text-sm text-gray-500">No notes yet</p>
              ) : (
                <ul className="space-y-3">
                  {notes.map((n) => (
                    <li
                      key={n.id}
                      className="p-3 rounded border bg-gray-50 text-sm cursor-pointer hover:border-[#1a4d8c]/40 hover:bg-white transition-colors"
                      onClick={() => setSelectedNote(n)}
                    >
                      <div className="flex justify-between text-xs text-gray-500 mb-2">
                        <span className="capitalize">{n.type.replaceAll("_", " ")}</span>
                        <span>
                          {n.signed_at ? "Signed" : "Draft"} ·{" "}
                          {format(new Date(n.created_at), "MM/dd/yyyy")}
                        </span>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-gray-700 truncate max-h-24 overflow-hidden">
                        {n.content}
                      </pre>
                    </li>
                  ))}
                </ul>
              )
            ) : notes.length === 0 ? (
              <p className="text-sm text-gray-500">No notes yet</p>
            ) : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="p-3 rounded border bg-gray-50 text-sm cursor-pointer hover:border-[#1a4d8c]/40 hover:bg-white transition-colors"
                    onClick={() => setSelectedNote(n)}
                  >
                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                      <span className="capitalize">{n.type.replaceAll("_", " ")}</span>
                      <span>
                        {n.signed_at ? "Signed" : "Draft"} ·{" "}
                        {format(new Date(n.created_at), "MM/dd/yyyy")}
                      </span>
                    </div>
                    <div className="mb-2 flex items-center gap-2 text-xs">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                        Co-sign: {(n.cosign_status || "not_required").replaceAll("_", " ")}
                      </span>
                      {n.cosigned_by_name && (
                        <span className="text-slate-500">
                          {n.cosigned_by_name}
                          {n.cosigned_at
                            ? ` · ${format(new Date(n.cosigned_at), "MM/dd HH:mm")}`
                            : ""}
                        </span>
                      )}
                      {n.is_addendum && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-indigo-700">
                          Addendum
                        </span>
                      )}
                      <span
                        className={`rounded px-1.5 py-0.5 ${
                          n.released_to_patient ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {n.released_to_patient ? "Released to patient" : "Not released"}
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-gray-700 truncate max-h-24 overflow-hidden">
                      {n.content}
                    </pre>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(n.cosign_status || "not_required") === "not_required" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            void requestCosign(n);
                          }}
                        >
                          Request Co-sign
                        </Button>
                      )}
                      {(n.cosign_status || "not_required") === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={!canCosign || cosigningNoteId === n.id}
                          title={!canCosign ? `${formatRoleLabel(currentUserRole)} cannot co-sign notes` : undefined}
                          onClick={(e) => {
                            e.stopPropagation();
                            void cosignNote(n);
                          }}
                        >
                          {cosigningNoteId === n.id ? "Co-signing..." : "Co-sign"}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedEncounterId && selectedEncounter && (
        <div className="grid gap-4 xl:grid-cols-2">
          <EncounterDiagnosisPanel
            encounterId={selectedEncounterId}
            initialCode={selectedEncounter.final_diagnosis_code}
            initialDescription={selectedEncounter.final_diagnosis_description}
            initialDdx={selectedEncounter.differential_diagnosis}
            initialPlan={selectedEncounter.final_treatment_plan}
            currentUserRole={currentUserRole}
            onSaved={() => router.refresh()}
          />
          <NursingFlowsheetPanel patientId={patient.id} encounterId={selectedEncounterId} />
          <HandoffPanel
            patientId={patient.id}
            encounterId={selectedEncounterId}
            currentUserRole={currentUserRole}
          />
        </div>
      )}

      <VitalsRecorder
        patientId={patient.id}
        initialVitals={vitals}
        activeEncounterId={encounters.find((e) => e.status === "active")?.id || null}
      />

      {showEditor && selectedEncounterId && (
        <NoteEditor
          encounterId={selectedEncounterId}
          onClose={() => setShowEditor(false)}
          onSaved={() => {
            setShowEditor(false);
            router.refresh();
          }}
        />
      )}
      {selectedNote && (
        <NoteDetailModal
          note={selectedNote}
          onClose={() => setSelectedNote(null)}
          onSaved={() => {
            setSelectedNote(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
