"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, X } from "lucide-react";

interface PatientNote {
  id: string;
  encounter_id: string;
  type: string;
  content: string;
  signed_at: string | null;
  created_at: string;
}

interface PatientNotesPanelProps {
  notes: PatientNote[];
  encounterLabels: Record<string, string>;
}

export function PatientNotesPanel({ notes, encounterLabels }: PatientNotesPanelProps) {
  const [selectedNote, setSelectedNote] = useState<PatientNote | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-700" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length > 0 ? (
            <div className="space-y-2">
              {notes.slice(0, 10).map((note) => (
                <button
                  type="button"
                  key={note.id}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-slate-50"
                  onClick={() => setSelectedNote(note)}
                >
                  <p className="text-sm font-medium capitalize">
                    {note.type.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {format(new Date(note.created_at), "MM/dd/yyyy HH:mm")} ·{" "}
                    {encounterLabels[note.encounter_id] || "Encounter"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600 line-clamp-2">
                    {note.content}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-primary">
                    Click to view full note
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No clinical notes available for your encounters yet.</p>
          )}
        </CardContent>
      </Card>

      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <Card className="flex max-h-[90vh] w-full max-w-3xl flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="capitalize">
                {selectedNote.type.replaceAll("_", " ")}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNote(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 overflow-y-auto">
              <p className="text-xs text-slate-500">
                {format(new Date(selectedNote.created_at), "MM/dd/yyyy HH:mm")} ·{" "}
                {encounterLabels[selectedNote.encounter_id] || "Encounter"}
                {selectedNote.signed_at ? " · Signed" : " · Draft"}
              </p>
              <pre className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                {selectedNote.content}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
