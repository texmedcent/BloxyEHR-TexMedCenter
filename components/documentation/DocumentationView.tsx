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
  selectedEncounterId?: string;
}

export function DocumentationView({
  patient,
  encounters,
  notes,
  vitals,
  selectedEncounterId,
}: DocumentationViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showEditor, setShowEditor] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const [creatingEncounter, setCreatingEncounter] = useState(false);
  const selectedEncounter =
    encounters.find((e) => e.id === selectedEncounterId) || null;

  const updateParams = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    router.push(`/documentation?${params.toString()}`);
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
      <h1 className="text-2xl font-semibold">Clinical Documentation</h1>
      <div className="flex items-center gap-4 flex-wrap">
        <span className="font-medium">
          {patient.last_name}, {patient.first_name}
        </span>
        <span className="text-sm text-gray-500">MRN: {patient.mrn}</span>
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
              <p className="text-sm text-gray-500">
                Select an encounter to view notes
              </p>
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
                      <span className="capitalize">{n.type}</span>
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
            )}
          </CardContent>
        </Card>
      </div>

      {selectedEncounterId && selectedEncounter && (
        <EncounterDiagnosisPanel
          encounterId={selectedEncounterId}
          initialCode={selectedEncounter.final_diagnosis_code}
          initialDescription={selectedEncounter.final_diagnosis_description}
          initialDdx={selectedEncounter.differential_diagnosis}
          initialPlan={selectedEncounter.final_treatment_plan}
          onSaved={() => router.refresh()}
        />
      )}

      <VitalsRecorder patientId={patient.id} initialVitals={vitals} />

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
