"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";

interface Note {
  id: string;
  type: string;
  content: string;
  signed_at: string | null;
  created_at: string;
  encounter_id?: string;
  cosign_status?: string;
  is_addendum?: boolean;
  parent_note_id?: string | null;
  addendum_reason?: string | null;
  released_to_patient?: boolean;
  patient_release_hold?: boolean;
  patient_release_hold_reason?: string | null;
}

interface NoteDetailModalProps {
  note: Note;
  onClose: () => void;
  onSaved: () => void;
}

function splitNoteContent(content: string, signedAt: string | null) {
  if (!signedAt) {
    return { body: content, signature: "" };
  }

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let lastNonEmpty = -1;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i].trim()) {
      lastNonEmpty = i;
      break;
    }
  }

  if (lastNonEmpty === -1) {
    return { body: "", signature: "" };
  }

  const signature = lines[lastNonEmpty].trim();
  const body = lines.slice(0, lastNonEmpty).join("\n").trimEnd();
  return { body, signature };
}

export function NoteDetailModal({ note, onClose, onSaved }: NoteDetailModalProps) {
  const parsed = useMemo(
    () => splitNoteContent(note.content, note.signed_at),
    [note.content, note.signed_at]
  );
  const [content, setContent] = useState(parsed.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addendumReason, setAddendumReason] = useState("");
  const [addendumContent, setAddendumContent] = useState("");
  const [savingAddendum, setSavingAddendum] = useState(false);
  const [releaseHold, setReleaseHold] = useState(Boolean(note.patient_release_hold));
  const [releaseHoldReason, setReleaseHoldReason] = useState(note.patient_release_hold_reason || "");
  const noteLocked = Boolean(note.signed_at || note.cosign_status === "co_signed");

  const handleSave = async () => {
    if (noteLocked) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const nextContent =
      note.signed_at && parsed.signature
        ? `${content.trimEnd()}\n\n${parsed.signature}`
        : content;

    const { error } = await supabase
      .from("clinical_notes")
      .update({
        content: nextContent,
      })
      .eq("id", note.id);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }

    onSaved();
  };

  const createAddendum = async () => {
    if (!note.encounter_id) {
      setError("Cannot create addendum: encounter not found.");
      return;
    }
    if (!addendumReason.trim() || !addendumContent.trim()) {
      setError("Addendum reason and content are required.");
      return;
    }
    setSavingAddendum(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSavingAddendum(false);
      setError("You must be logged in.");
      return;
    }
    const { error: addendumError } = await supabase.from("clinical_notes").insert({
      encounter_id: note.encounter_id,
      author_id: user.id,
      type: note.type,
      content: addendumContent.trim(),
      is_addendum: true,
      parent_note_id: note.id,
      addendum_reason: addendumReason.trim(),
      signed_at: new Date().toISOString(),
    });
    setSavingAddendum(false);
    if (addendumError) {
      setError(addendumError.message);
      return;
    }
    onSaved();
  };

  const updateRelease = async (release: boolean) => {
    const supabase = createClient();
    setSaving(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSaving(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const actorName = profile?.full_name || user.email || "Clinician";
    const payload = release
      ? {
          released_to_patient: true,
          released_to_patient_at: new Date().toISOString(),
          released_to_patient_by: user.id,
          released_to_patient_by_name: actorName,
          patient_release_hold: false,
          patient_release_hold_reason: null,
        }
      : {
          released_to_patient: false,
          released_to_patient_at: null,
          released_to_patient_by: null,
          released_to_patient_by_name: null,
          patient_release_hold: releaseHold,
          patient_release_hold_reason: releaseHold ? releaseHoldReason.trim() || "Hold" : null,
        };
    const { error: releaseError } = await supabase
      .from("clinical_notes")
      .update(payload)
      .eq("id", note.id);
    setSaving(false);
    if (releaseError) {
      setError(releaseError.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between shrink-0">
          <CardTitle>Edit Clinical Note</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col gap-4 overflow-y-auto">
          <div>
            <Label>Content</Label>
            <Textarea
              className="mt-1 min-h-[260px] resize-y"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={noteLocked}
            />
            {noteLocked && (
              <p className="mt-1 text-xs text-amber-700">
                Signed/co-signed note content is locked. Create an addendum instead.
              </p>
            )}
          </div>

          {note.signed_at && parsed.signature && (
            <div>
              <Label>Signature</Label>
              <p className="mt-1 whitespace-pre-wrap rounded border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {parsed.signature}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Signature is shown on a separate line below the note text.
              </p>
            </div>
          )}

          <div className="rounded border border-slate-200 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Patient Portal Release
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" disabled={saving} onClick={() => updateRelease(true)}>
                Release to Patient
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving || !releaseHold}
                onClick={() => updateRelease(false)}
              >
                Save Hold
              </Button>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={releaseHold}
                  onChange={(e) => setReleaseHold(e.target.checked)}
                />
                Hold from patient portal
              </label>
              {releaseHold && (
                <input
                  className="h-8 rounded border border-slate-300 px-2 text-xs"
                  value={releaseHoldReason}
                  onChange={(e) => setReleaseHoldReason(e.target.value)}
                  placeholder="Hold reason"
                />
              )}
            </div>
          </div>

          {noteLocked && (
            <div className="rounded border border-slate-200 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                Addendum
              </p>
              <div className="space-y-2">
                <div>
                  <Label>Addendum Reason</Label>
                  <Textarea
                    className="mt-1 min-h-[60px]"
                    value={addendumReason}
                    onChange={(e) => setAddendumReason(e.target.value)}
                    placeholder="Why this addendum is needed."
                  />
                </div>
                <div>
                  <Label>Addendum Content</Label>
                  <Textarea
                    className="mt-1 min-h-[120px]"
                    value={addendumContent}
                    onChange={(e) => setAddendumContent(e.target.value)}
                    placeholder="Addendum narrative."
                  />
                </div>
                <div>
                  <Button size="sm" variant="outline" onClick={createAddendum} disabled={savingAddendum}>
                    {savingAddendum ? "Saving..." : "Create Addendum"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handleSave} disabled={saving || noteLocked}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
