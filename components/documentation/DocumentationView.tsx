"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Stethoscope, UserSearch } from "lucide-react";
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
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-[#1a4d8c] dark:text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Clinical Documentation</h1>
            <p className="text-sm text-slate-600 dark:text-muted-foreground">
              View and add clinical notes for your patients.
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
                      onClick={() => updateParams({ patientId: p.id, encounterId: "" })}
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
              onSelect={(id) => updateParams({ patientId: id, encounterId: "" })}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-[#1a4d8c] dark:text-primary" />
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold">Clinical Documentation</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <span className="font-medium text-slate-800 dark:text-foreground">
              {patient.last_name}, {patient.first_name}
            </span>
            <span className="text-sm text-slate-500 dark:text-muted-foreground">
              MRN {patient.mrn}
            </span>
            {selectedEncounterId && (
              <span className="rounded-full bg-blue-100 dark:bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:text-primary">
                Encounter selected
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 dark:border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
              Encounters
            </CardTitle>
          </CardHeader>
          <CardContent>
            {encounters.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-border p-6 text-center">
                <Stethoscope className="mx-auto h-10 w-10 text-slate-300 dark:text-muted-foreground mb-2" />
                <p className="text-sm text-slate-600 dark:text-muted-foreground mb-3">
                  No encounters yet. Start one to document notes.
                </p>
                <CreateEncounterButton
                  patientId={patient.id}
                  onCreated={(encId) => {
                    updateParams({ patientId: patient.id, encounterId: encId });
                    setCreatingEncounter(false);
                  }}
                  isLoading={creatingEncounter}
                  onLoadingChange={setCreatingEncounter}
                />
              </div>
            ) : (
              <ul className="space-y-1.5">
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
                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                        selectedEncounterId === e.id
                          ? "border-primary dark:border-primary bg-primary/5 dark:bg-primary/10"
                          : "border-slate-200 dark:border-border hover:bg-slate-50 dark:hover:bg-muted/50"
                      }`}
                    >
                      <span className="font-medium capitalize text-slate-800 dark:text-foreground">
                        {e.type}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-muted-foreground mt-0.5">
                        {e.admit_date
                          ? format(new Date(e.admit_date), "MMM d, yyyy")
                          : "—"}
                        {" · "}
                        <span className="capitalize">{e.status}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500 dark:text-muted-foreground" />
              Notes
            </CardTitle>
            {selectedEncounterId && (
              <Button size="sm" onClick={() => setShowEditor(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Note
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedEncounterId ? (
              notes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 dark:border-border p-6 text-center">
                  <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-muted-foreground mb-2" />
                  <p className="text-sm text-slate-600 dark:text-muted-foreground">
                    Select an encounter to view notes.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li key={n.id}>
                      <NoteCard n={n} format={format} onClick={() => setSelectedNote(n)} />
                    </li>
                  ))}
                </ul>
              )
            ) : notes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-border p-6 text-center">
                <FileText className="mx-auto h-10 w-10 text-slate-300 dark:text-muted-foreground mb-2" />
                <p className="text-sm text-slate-600 dark:text-muted-foreground mb-3">
                  No notes for this encounter yet.
                </p>
                <Button size="sm" onClick={() => setShowEditor(true)}>
                  Add first note
                </Button>
              </div>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id}>
                    <NoteCard
                      n={n}
                      format={format}
                      onClick={() => setSelectedNote(n)}
                      canCosign={canCosign}
                      cosigningNoteId={cosigningNoteId}
                      currentUserRole={currentUserRole}
                      formatRoleLabel={formatRoleLabel}
                      onRequestCosign={() => void requestCosign(n)}
                      onCosign={() => void cosignNote(n)}
                    />
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

      {showEditor && selectedEncounterId && patient && (
        <NoteEditor
          encounterId={selectedEncounterId}
          patientId={patient.id}
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

function NoteCard({
  n,
  format,
  onClick,
  canCosign,
  cosigningNoteId,
  currentUserRole,
  formatRoleLabel,
  onRequestCosign,
  onCosign,
}: {
  n: Note;
  format: (d: Date, f: string) => string;
  onClick: () => void;
  canCosign?: boolean;
  cosigningNoteId?: string | null;
  currentUserRole?: string | null;
  formatRoleLabel?: (r: string | null) => string;
  onRequestCosign?: () => void;
  onCosign?: () => void;
}) {
  const cosignStatus = n.cosign_status || "not_required";
  return (
    <div
      onClick={onClick}
      className="rounded-lg border border-slate-200 dark:border-border bg-slate-50/50 dark:bg-muted/30 p-3 cursor-pointer hover:border-[#1a4d8c]/40 dark:hover:border-primary/40 hover:bg-white dark:hover:bg-card transition-colors"
    >
      <div className="flex justify-between items-start gap-2 mb-2">
        <span className="capitalize font-medium text-slate-800 dark:text-foreground">
          {n.type.replaceAll("_", " ")}
        </span>
        <span className="text-xs text-slate-500 dark:text-muted-foreground shrink-0">
          {n.signed_at ? "Signed" : "Draft"} · {format(new Date(n.created_at), "MMM d, yyyy")}
        </span>
      </div>
      {(cosignStatus !== "not_required" || n.cosigned_by_name || n.is_addendum || n.released_to_patient !== undefined) && (
        <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
          {cosignStatus !== "not_required" && (
            <span className="rounded-full bg-slate-200/80 dark:bg-muted px-2 py-0.5 text-slate-700 dark:text-muted-foreground">
              Co-sign: {cosignStatus.replaceAll("_", " ")}
            </span>
          )}
          {n.cosigned_by_name && (
            <span className="text-slate-500 dark:text-muted-foreground">
              {n.cosigned_by_name}
              {n.cosigned_at ? ` · ${format(new Date(n.cosigned_at), "MM/dd HH:mm")}` : ""}
            </span>
          )}
          {n.is_addendum && (
            <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 text-indigo-700 dark:text-indigo-300">
              Addendum
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 ${
              n.released_to_patient
                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                : "bg-slate-200/80 dark:bg-muted text-slate-600 dark:text-muted-foreground"
            }`}
          >
            {n.released_to_patient ? "Released" : "Not released"}
          </span>
        </div>
      )}
      <pre className="whitespace-pre-wrap font-sans text-slate-700 dark:text-foreground truncate max-h-20 overflow-hidden text-sm">
        {n.content}
      </pre>
      {onRequestCosign && cosignStatus === "not_required" && (
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onRequestCosign();
            }}
          >
            Request Co-sign
          </Button>
        </div>
      )}
      {onCosign && cosignStatus === "pending" && (
        <div className="mt-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={!canCosign || cosigningNoteId === n.id}
            title={!canCosign && currentUserRole ? `${formatRoleLabel?.(currentUserRole)} cannot co-sign` : undefined}
            onClick={(e) => {
              e.stopPropagation();
              onCosign();
            }}
          >
            {cosigningNoteId === n.id ? "Co-signing…" : "Co-sign"}
          </Button>
        </div>
      )}
    </div>
  );
}
